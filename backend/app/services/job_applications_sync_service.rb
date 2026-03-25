require "json"
require "digest"

class JobApplicationsSyncService
  JOB_SEARCH_DIR = Rails.root.join("..", "..", "memory", "job-search").expand_path.freeze

  def self.call(...)
    new(...).call
  end

  def initialize(with_stats: false)
    @with_stats = with_stats
  end

  def call
    stats = {
      files_scanned: 0,
      records_seen: 0,
      records_upserted: 0,
      source_path: JOB_SEARCH_DIR.to_s,
      scanned_files: []
    }

    return @with_stats ? stats : 0 unless job_applications_ready?

    source_files.each do |path|
      stats[:files_scanned] += 1
      stats[:scanned_files] << File.basename(path)
      payload = parse_json(path)
      next if payload.blank?

      seen, upserted = import_payload(path, payload)
      stats[:records_seen] += seen
      stats[:records_upserted] += upserted
    end

    @with_stats ? stats : stats[:records_upserted]
  end

  private

  def source_files
    Dir[JOB_SEARCH_DIR.join("applied-*.json")].sort
  end

  def parse_json(path)
    JSON.parse(File.read(path))
  rescue JSON::ParserError => e
    Rails.logger.warn("JobApplicationsSyncService: failed to parse #{path}: #{e.message}")
    nil
  rescue Errno::ENOENT
    nil
  end

  def import_payload(path, payload)
    # Handle plain arrays (e.g. [{company:..., title:...}, ...])
    if payload.is_a?(Array)
      import_plain_array(path, payload)
    elsif payload.is_a?(Hash) && payload["applications"].is_a?(Array)
      import_application_list(path, payload)
    elsif payload.is_a?(Hash) && payload["jobs"].is_a?(Array)
      import_jobs_list(path, payload)
    elsif payload.is_a?(Hash) && payload["applied"].is_a?(Array)
      import_applied_list(path, payload)
    else
      [0, 0]
    end
  end

  def import_plain_array(path, items)
    upserted = items.count do |item|
      next false unless item.is_a?(Hash) && (item["company"].present? || item["title"].present?)

      upsert_application!(
        source: "assistant",
        external_uid: external_uid_for(path, item["requisition_id"] || item["url"] || item["title"], item),
        title: item["title"] || item["role"] || "Unknown Role",
        company: item["company"] || "Unknown Company",
        location: item["location"],
        url: item["url"],
        status: normalize_status(item["status"] || "applied"),
        applied_on: parse_date(item["date"]) || filename_date(path),
        notes: item["notes"],
        external_data: item.merge("source_file" => File.basename(path), "ingest_format" => "plain_array")
      )
    end
    [items.size, upserted]
  end

  def import_application_list(path, payload)
    items = payload.fetch("applications", [])
    upserted = items.count do |item|
      upsert_application!(
        source: "assistant",
        external_uid: external_uid_for(path, item["id"] || item["url"] || item["role"], item),
        title: item["role"] || item["title"] || "Unknown Role",
        company: item["company"] || "Unknown Company",
        location: item["location"],
        url: item["url"],
        status: normalize_status(item["status"]),
        applied_on: parse_date(item["date"]) || filename_date(path),
        notes: item["notes"],
        external_data: item.merge("source_file" => File.basename(path), "ingest_format" => "applications")
      )
    end
    [items.size, upserted]
  end

  def import_jobs_list(path, payload)
    items = payload.fetch("jobs", [])
    upserted = items.count do |item|
      upsert_application!(
        source: "assistant",
        external_uid: external_uid_for(path, item["jobId"] || item["applyUrl"] || item["title"], item),
        title: item["title"] || "Unknown Role",
        company: item["company"] || "Unknown Company",
        location: item["location"].is_a?(Hash) ? item["location"]["primary"] : item["location"],
        url: item["applyUrl"] || item["url"],
        status: normalize_status(item["status"] || item["applicationStatus"]),
        applied_on: parse_date(item["date"]) || parse_date(payload["batchDate"]) || filename_date(path),
        notes: item["notes"] || payload["summary"],
        external_data: item.merge(
          "source_file" => File.basename(path),
          "batch_status" => payload["status"],
          "batch_id" => payload["batchId"],
          "ingest_format" => "jobs"
        )
      )
    end
    [items.size, upserted]
  end

  def import_applied_list(path, payload)
    items = payload.fetch("applied", [])
    upserted = items.count do |item|
      upsert_application!(
        source: "assistant",
        external_uid: external_uid_for(path, item["id"] || item["url"] || item["title"], item),
        title: item["title"] || item["role"] || "Unknown Role",
        company: item["company"] || "Unknown Company",
        location: item["location"],
        url: item["url"],
        status: normalize_status(item["status"] || "applied"),
        applied_on: parse_date(item["date"]) || parse_date(payload["date"]) || filename_date(path),
        notes: item["notes"] || payload["notes"],
        external_data: item.merge("source_file" => File.basename(path), "ingest_format" => "applied")
      )
    end
    [items.size, upserted]
  end

  def upsert_application!(attributes)
    record = JobApplication.find_or_initialize_by(source: attributes[:source], external_uid: attributes[:external_uid])
    record.assign_attributes(attributes)
    record.save!
  end

  def job_applications_ready?
    defined?(JobApplication) && JobApplication.table_exists?
  rescue StandardError
    false
  end

  def normalize_status(value)
    text = value.to_s.strip.downcase

    return "applied" if text.include?("applied") || text.include?("complete")
    return "pending" if text.include?("pending") || text.include?("ready") || text.include?("compiled")
    return "started" if text.include?("start") || text.include?("progress") || text.include?("incomplete")
    return "rejected" if text.include?("reject")
    return "interview" if text.include?("interview")
    return "offer" if text.include?("offer")
    return "withdrawn" if text.include?("withdraw")

    JobApplication::STATUSES.include?(text) ? text : "pending"
  end

  def parse_date(value)
    return if value.blank?

    Date.parse(value.to_s)
  rescue ArgumentError
    nil
  end

  def filename_date(path)
    match = File.basename(path).match(/(\d{4}-\d{2}-\d{2})/)
    parse_date(match && match[1])
  end

  def external_uid_for(path, primary_key, item)
    seed = [File.basename(path), primary_key, item["company"], item["title"], item["role"]].compact.join("|")
    Digest::SHA256.hexdigest(seed)
  end
end
