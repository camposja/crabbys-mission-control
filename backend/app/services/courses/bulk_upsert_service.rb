module Courses
  # Agent-friendly (Hermes/OpenClaw) bulk upsert for course data.
  #
  # Idempotency: records are matched by a parent-SCOPED external_id, never a
  # global lookup. `intro` under one unit is distinct from `intro` under another.
  #
  # Deletes are EXPLICIT ONLY: nothing is removed just because it is absent from
  # the payload. Callers must pass a `deletes`/`operations` array.
  #
  # Everything runs in one transaction — an invalid record raises RecordInvalid
  # and the whole batch rolls back (controller renders 422).
  class BulkUpsertService
    COURSE_ATTRS = %i[title description status provider diploma diploma_notes
                      started_on completed_on metadata].freeze
    UNIT_ATTRS   = %i[title description position unit_type status metadata].freeze
    NOTE_ATTRS   = %i[note_type title body author metadata].freeze
    LINK_ATTRS   = %i[url title source_type notes metadata].freeze

    def initialize(payload)
      @payload = (payload || {}).deep_symbolize_keys
      @summary = {
        created: Hash.new(0),
        updated: Hash.new(0),
        deleted: Hash.new(0),
        errors: []
      }
    end

    def call
      ActiveRecord::Base.transaction do
        Array(@payload[:courses]).each { |c| upsert_course(c) }
        delete_entries.each { |d| process_delete(d) }
      end
      normalize(@summary)
    end

    private

    def delete_entries
      Array(@payload[:operations]).select { |o| o[:operation].to_s == "delete" } +
        Array(@payload[:deletes])
    end

    # ── Upserts ─────────────────────────────────────────────────────────────

    def upsert_course(data)
      course = find_or_init(Course, data[:external_id], data[:id])
      track(:course, course)
      course.assign_attributes(data.slice(*COURSE_ATTRS).compact)
      course.external_id ||= data[:external_id]
      course.save!

      Array(data[:notes]).each { |n| upsert_note(course, n) }
      Array(data[:links]).each { |l| upsert_link(course, l) }
      Array(data[:units]).each { |u| upsert_unit(course, u) }
      course
    end

    def upsert_unit(course, data)
      # Scoped through the course association — honors per-course uniqueness.
      unit = find_or_init(course.course_units, data[:external_id], data[:id])
      track(:course_unit, unit)
      unit.assign_attributes(data.slice(*UNIT_ATTRS).compact)
      unit.external_id ||= data[:external_id]
      unit.save!

      Array(data[:notes]).each { |n| upsert_note(unit, n) }
      Array(data[:links]).each { |l| upsert_link(unit, l) }
      unit
    end

    def upsert_note(owner, data)
      # Scoped through the owner's notes association.
      note = find_or_init(owner.notes, data[:external_id], data[:id])
      track(:note, note)
      note.assign_attributes(data.slice(*NOTE_ATTRS).compact)
      note.external_id ||= data[:external_id]
      note.save!
      note
    end

    def upsert_link(owner, data)
      link = find_or_init(owner.links, data[:external_id], data[:id])
      track(:link, link)
      link.assign_attributes(data.slice(*LINK_ATTRS).compact)
      link.external_id ||= data[:external_id]
      link.save!
      link
    end

    # ── Explicit deletes ──────────────────────────────────────────────────────

    def process_delete(entry)
      entity = entry[:entity].to_s
      record =
        case entity
        when "course"      then Course.find_by(external_id: entry[:external_id])
        when "course_unit" then delete_scope_course(entry)&.course_units&.find_by(external_id: entry[:external_id])
        when "note"        then delete_owner(entry)&.notes&.find_by(external_id: entry[:external_id])
        when "link"        then delete_owner(entry)&.links&.find_by(external_id: entry[:external_id])
        else
          @summary[:errors] << "unknown delete entity: #{entity.inspect}"
          return
        end

      if record
        record.destroy!
        @summary[:deleted][entity.to_sym] += 1
      else
        @summary[:errors] << "delete target not found: #{entity} #{entry[:external_id].inspect}"
      end
    end

    def delete_scope_course(entry)
      Course.find_by(external_id: entry[:course_external_id])
    end

    # Note/link owner: a unit when unit_external_id is given, else the course.
    def delete_owner(entry)
      course = delete_scope_course(entry)
      return nil unless course
      return course if entry[:unit_external_id].blank?

      course.course_units.find_by(external_id: entry[:unit_external_id])
    end

    # ── Helpers ────────────────────────────────────────────────────────────────

    # Resolution order: prefer an explicit `id` (anchored THROUGH the parent scope, so a
    # wrong-parent id raises RecordNotFound → 404 and can never touch another parent's
    # record), then `external_id`, else a new record. When both id and external_id are
    # given (scoped manual import), we find by id and backfill the external_id.
    def find_or_init(scope, external_id, id)
      if id.present?
        record = scope.find(id)
        record.external_id = external_id if external_id.present?
        return record
      end
      return scope.find_or_initialize_by(external_id: external_id) if external_id.present?

      scope.new
    end

    def track(entity, record)
      bucket = record.new_record? ? :created : :updated
      @summary[bucket][entity] += 1
    end

    def normalize(summary)
      {
        created: summary[:created],
        updated: summary[:updated],
        deleted: summary[:deleted],
        errors: summary[:errors]
      }
    end
  end
end
