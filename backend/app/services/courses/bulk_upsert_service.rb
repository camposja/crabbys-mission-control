module Courses
  # Agent-friendly (Hermes/OpenClaw) bulk upsert for course data.
  #
  # Idempotency: records are matched by a parent-SCOPED external_id (or an explicit
  # id anchored through the parent), never a global lookup.
  #
  # Deletes are EXPLICIT ONLY. Malformed delete ops always fail (422). A well-formed
  # delete whose target is already gone fails 422 too — UNLESS the payload sets
  # `ignore_missing_deletes: true`, which makes missing targets a skipped no-op so
  # an agent can safely re-send a whole payload.
  #
  # Everything runs in ONE transaction. Any problem raises Courses::BulkUpsertError
  # (structured details) and the whole batch rolls back — never a partial write.
  class BulkUpsertService
    COURSE_ATTRS = %i[title description status provider diploma diploma_notes
                      started_on completed_on metadata].freeze
    UNIT_ATTRS   = %i[title description position unit_type status metadata].freeze
    NOTE_ATTRS   = %i[note_type title body author metadata].freeze
    LINK_ATTRS   = %i[url title source_type notes metadata].freeze
    DELETE_ENTITIES = %w[course course_unit note link].freeze

    def initialize(payload)
      @raw = payload
      @summary = {
        created: Hash.new(0),
        updated: Hash.new(0),
        deleted: Hash.new(0),
        skipped: Hash.new(0),
        errors: []
      }
    end

    def call
      validate_shape!
      ignore_missing = truthy?(@payload[:ignore_missing_deletes])
      ActiveRecord::Base.transaction do
        Array(@payload[:courses]).each_with_index { |c, i| upsert_course(c, "courses[#{i}]") }
        delete_entries.each { |e| process_delete(e[:data], e[:path], ignore_missing) }
      end
      normalize
    end

    private

    # ── Shape validation (pre-transaction) ──────────────────────────────────────

    def validate_shape!
      unless @raw.is_a?(Hash) || @raw.respond_to?(:to_h)
        fail!(entity: "payload", op: "upsert", path: "payload", message: "payload must be a JSON object")
      end
      @payload = @raw.to_h.deep_symbolize_keys

      if @payload[:_json].present?
        fail!(entity: "payload", op: "upsert", path: "payload", message: "payload must be a JSON object, not an array")
      end

      courses = @payload[:courses]
      if !courses.nil? && !courses.is_a?(Array)
        fail!(entity: "payload", op: "upsert", path: "courses", message: "courses must be an array")
      end

      deletes_present = Array(@payload[:operations]).any? || Array(@payload[:deletes]).any?
      if Array(courses).empty? && !deletes_present
        fail!(entity: "payload", op: "upsert", path: "payload",
              message: "payload must include courses or delete operations")
      end
    end

    # ── Upserts ─────────────────────────────────────────────────────────────────

    def upsert_course(data, path)
      ensure_object!(data, "course", path)
      course = guard("course", path, data) do
        rec = find_or_init(Course, data[:external_id], data[:id], "course", path)
        track("course", rec)
        rec.assign_attributes(data.slice(*COURSE_ATTRS).compact)
        rec.external_id ||= data[:external_id]
        rec.save!
        rec
      end

      Array(data[:notes]).each_with_index { |n, i| upsert_note(course, n, "#{path}.notes[#{i}]") }
      Array(data[:links]).each_with_index { |l, i| upsert_link(course, l, "#{path}.links[#{i}]") }
      Array(data[:units]).each_with_index { |u, i| upsert_unit(course, u, "#{path}.units[#{i}]") }
      course
    end

    def upsert_unit(course, data, path)
      ensure_object!(data, "course_unit", path)
      unit = guard("course_unit", path, data) do
        rec = find_or_init(course.course_units, data[:external_id], data[:id], "course_unit", path)
        track("course_unit", rec)
        rec.assign_attributes(data.slice(*UNIT_ATTRS).compact)
        rec.external_id ||= data[:external_id]
        rec.save!
        rec
      end

      Array(data[:notes]).each_with_index { |n, i| upsert_note(unit, n, "#{path}.notes[#{i}]") }
      Array(data[:links]).each_with_index { |l, i| upsert_link(unit, l, "#{path}.links[#{i}]") }
      unit
    end

    def upsert_note(owner, data, path)
      ensure_object!(data, "note", path)
      guard("note", path, data) do
        rec = find_or_init(owner.notes, data[:external_id], data[:id], "note", path)
        track("note", rec)
        rec.assign_attributes(data.slice(*NOTE_ATTRS).compact)
        rec.external_id ||= data[:external_id]
        rec.save!
        rec
      end
    end

    def upsert_link(owner, data, path)
      ensure_object!(data, "link", path)
      guard("link", path, data) do
        rec = find_or_init(owner.links, data[:external_id], data[:id], "link", path)
        track("link", rec)
        rec.assign_attributes(data.slice(*LINK_ATTRS).compact)
        rec.external_id ||= data[:external_id]
        rec.save!
        rec
      end
    end

    # ── Explicit deletes ────────────────────────────────────────────────────────

    def delete_entries
      ops = Array(@payload[:operations]).each_with_index
            .select { |o, _| o.is_a?(Hash) && o[:operation].to_s == "delete" }
            .map { |o, i| { data: o, path: "operations[#{i}]" } }
      dels = Array(@payload[:deletes]).each_with_index
             .map { |d, i| { data: d, path: "deletes[#{i}]" } }
      ops + dels
    end

    def process_delete(entry, path, ignore_missing)
      entry = {} unless entry.is_a?(Hash)
      entity = entry[:entity].to_s

      # Malformed delete ops ALWAYS fail (independent of ignore_missing_deletes).
      unless DELETE_ENTITIES.include?(entity)
        fail!(entity: entity.presence, op: "delete", path: path, external_id: entry[:external_id],
              message: "unknown delete entity: #{entity.inspect}")
      end
      if entry[:external_id].blank?
        fail!(entity: entity, op: "delete", path: path, message: "delete requires external_id")
      end
      if entity != "course" && entry[:course_external_id].blank?
        fail!(entity: entity, op: "delete", path: path, external_id: entry[:external_id],
              message: "delete of #{entity} requires course_external_id")
      end

      record = resolve_delete_target(entity, entry)
      if record
        record.destroy!
        @summary[:deleted][entity] += 1
      elsif ignore_missing
        @summary[:skipped][entity] += 1
      else
        fail!(entity: entity, op: "delete", path: path, external_id: entry[:external_id],
              message: "delete target not found: #{entity} #{entry[:external_id].inspect}")
      end
    end

    def resolve_delete_target(entity, entry)
      case entity
      when "course"      then Course.find_by(external_id: entry[:external_id])
      when "course_unit" then delete_course(entry)&.course_units&.find_by(external_id: entry[:external_id])
      when "note"        then delete_owner(entry)&.notes&.find_by(external_id: entry[:external_id])
      when "link"        then delete_owner(entry)&.links&.find_by(external_id: entry[:external_id])
      end
    end

    def delete_course(entry)
      Course.find_by(external_id: entry[:course_external_id])
    end

    def delete_owner(entry)
      course = delete_course(entry)
      return nil unless course
      return course if entry[:unit_external_id].blank?

      course.course_units.find_by(external_id: entry[:unit_external_id])
    end

    # ── Helpers ─────────────────────────────────────────────────────────────────

    # Prefer an explicit id (anchored THROUGH the parent scope so a wrong-parent id
    # cannot touch another parent's record), then external_id, else a new record.
    # When both are given, find by id and backfill external_id — unless that
    # external_id already belongs to a different record in scope (→ 422 conflict).
    def find_or_init(scope, external_id, id, entity, path)
      if id.present?
        record = scope.find(id) # RecordNotFound → guard → 422
        if external_id.present?
          conflict = scope.where(external_id: external_id).where.not(id: record.id).exists?
          if conflict
            fail!(entity: entity, op: "upsert", external_id: external_id, id: id, path: path,
                  message: "external_id #{external_id.inspect} already belongs to a different #{entity}")
          end
          record.external_id = external_id
        end
        return record
      end
      return scope.find_or_initialize_by(external_id: external_id) if external_id.present?

      scope.new
    end

    # Converts ActiveRecord failures into structured BulkUpsertError details.
    def guard(entity, path, data)
      yield
    rescue ActiveRecord::RecordInvalid => e
      fail!(entity: entity, op: "upsert", external_id: data[:external_id], id: data[:id], path: path,
            message: e.record.errors.full_messages.join(", "))
    rescue ActiveRecord::RecordNotFound
      fail!(entity: entity, op: "upsert", external_id: data[:external_id], id: data[:id], path: path,
            message: "#{entity} not found for id=#{data[:id].inspect} under the given parent")
    end

    def ensure_object!(data, entity, path)
      return if data.is_a?(Hash)

      fail!(entity: entity, op: "upsert", path: path, message: "#{entity} entry must be an object")
    end

    def track(entity, record)
      bucket = record.new_record? ? :created : :updated
      @summary[bucket][entity] += 1
    end

    def fail!(entity:, op:, path:, message:, external_id: nil, id: nil)
      raise BulkUpsertError.new([{
        entity: entity, operation: op, external_id: external_id, id: id, path: path, message: message
      }])
    end

    def truthy?(value)
      value == true || value.to_s == "true"
    end

    def normalize
      {
        created: @summary[:created],
        updated: @summary[:updated],
        deleted: @summary[:deleted],
        skipped: @summary[:skipped],
        errors: @summary[:errors]
      }
    end
  end
end
