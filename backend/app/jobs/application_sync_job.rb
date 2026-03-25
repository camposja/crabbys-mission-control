# Syncs job applications from the workspace JSON files into CalendarEvent records.
# Reads applied-YYYY-MM-DD.json files from memory/job-search/ and creates
# calendar events with event_type "job_application" so they appear in the
# calendar views and can be tracked.
#
# Safe to run repeatedly — uses company + requisition_id + date as a unique key
# to avoid duplicates.
class ApplicationSyncJob < ApplicationJob
  queue_as :default

  APPLICATIONS_DIR = File.join(
    ENV.fetch("OPENCLAW_HOME", File.expand_path("~/.openclaw")),
    "workspace", "memory", "job-search"
  )

  def perform
    return unless Dir.exist?(APPLICATIONS_DIR)

    # Find the Job Search project to link applications
    job_search_project = Project.find_by("lower(name) = ?", "job search")

    files = Dir.glob(File.join(APPLICATIONS_DIR, "applied-*.json")).sort
    total_synced = 0
    total_skipped = 0

    files.each do |file|
      begin
        applications = JSON.parse(File.read(file))
        applications = [applications] unless applications.is_a?(Array)

        applications.each do |app|
          next unless app.is_a?(Hash) && app["company"].present? && app["title"].present?

          # Build a unique reference to prevent duplicates
          ref = [app["company"], app["title"], app["date"], app["requisition_id"]].compact.join("|")
          gateway_ref = "job-app:#{Digest::SHA256.hexdigest(ref)[0..15]}"

          existing = CalendarEvent.find_by(gateway_reference: gateway_ref)
          if existing
            total_skipped += 1
            next
          end

          applied_date = begin
            Time.parse(app["date"])
          rescue
            File.mtime(file)
          end

          CalendarEvent.create!(
            title:             "Applied: #{app['title']} @ #{app['company']}",
            description:       build_description(app),
            starts_at:         applied_date,
            event_type:        "job_application",
            status:            map_status(app["status"]),
            source:            "manual",
            project_id:        job_search_project&.id,
            gateway_reference: gateway_ref,
            metadata: {
              company:        app["company"],
              role:           app["title"],
              location:       app["location"],
              requisition_id: app["requisition_id"],
              source_board:   app["source"],
              resume_used:    app["resume_used"],
              salary_range:   app["salary_range"],
              applied_date:   app["date"],
              notes:          app["notes"]
            }
          )
          total_synced += 1
        end
      rescue JSON::ParserError => e
        Rails.logger.warn("[ApplicationSyncJob] Failed to parse #{file}: #{e.message}")
      rescue => e
        Rails.logger.warn("[ApplicationSyncJob] Error processing #{file}: #{e.message}")
      end
    end

    EventStore.emit(
      type:     "application_sync",
      message:  "Application sync: #{total_synced} new, #{total_skipped} already tracked",
      metadata: { synced: total_synced, skipped: total_skipped, files: files.size }
    )

    Rails.logger.info("[ApplicationSyncJob] Synced #{total_synced} new applications, skipped #{total_skipped}")
  end

  private

  def build_description(app)
    parts = []
    parts << "**Company:** #{app['company']}" if app["company"]
    parts << "**Role:** #{app['title']}" if app["title"]
    parts << "**Location:** #{app['location']}" if app["location"]
    parts << "**Salary:** #{app['salary_range']}" if app["salary_range"]
    parts << "**Source:** #{app['source']}" if app["source"]
    parts << "**Requisition:** #{app['requisition_id']}" if app["requisition_id"]
    parts << "**Resume:** #{app['resume_used']}" if app["resume_used"]
    parts << ""
    parts << app["notes"] if app["notes"]
    parts.join("\n")
  end

  def map_status(status)
    case status.to_s.downcase
    when "applied"   then "completed"
    when "interview" then "scheduled"
    when "rejected"  then "failed"
    when "offer"     then "completed"
    else "completed"
    end
  end
end
