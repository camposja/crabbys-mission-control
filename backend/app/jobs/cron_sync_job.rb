# Syncs cron jobs from the OpenClaw gateway into the local CronJob table.
# Runs on a schedule (every 5 minutes via recurring.yml) so that any new
# cron jobs created through OpenClaw automatically appear in Mission Control.
class CronSyncJob < ApplicationJob
  queue_as :default

  def perform
    client = ::Openclaw::GatewayClient.new

    begin
      data = client.rpc("cron.list")
    rescue ::Openclaw::GatewayError => e
      Rails.logger.warn("[CronSyncJob] Gateway unreachable: #{e.message}")
      return
    end

    gateway_jobs = Array.wrap(data.is_a?(Array) ? data : (data["jobs"] || data["data"] || []))
    return if gateway_jobs.empty?

    synced_ids = []

    gateway_jobs.each do |gj|
      gateway_id = gj["id"] || gj["jobId"]
      name       = gj["name"] || gateway_id
      schedule   = gj["schedule"] || {}
      state      = gj["state"] || {}
      enabled    = gj.fetch("enabled", true)

      # Extract cron expression from schedule
      cron_expr = case schedule["kind"]
                  when "cron" then schedule["expr"]
                  when "every" then "every #{(schedule['everyMs'].to_i / 1000)}s"
                  when "at" then "at #{schedule['at']}"
                  else schedule.to_s.truncate(100)
                  end

      # Find or create the local record
      local = CronJob.find_or_initialize_by(gateway_reference: gateway_id)
      local.assign_attributes(
        name:            name,
        cron_expression: cron_expr || "unknown",
        command:         "gateway-managed",
        enabled:         enabled,
        status:          enabled ? "active" : "idle",
        next_run_at:     state["nextRunAtMs"] ? Time.at(state["nextRunAtMs"] / 1000.0) : nil,
        last_run_at:     state["lastRunAtMs"] ? Time.at(state["lastRunAtMs"] / 1000.0) : nil,
        failure_count:   state["consecutiveErrors"] || 0,
        last_error:      state["lastRunStatus"] == "error" ? (state["lastError"] || "unknown error") : nil,
        sync_source:     "gateway",
        synced_at:       Time.current
      )

      if local.changed?
        local.save!
        Rails.logger.info("[CronSyncJob] Synced cron job: #{name} (#{gateway_id})")
      end

      synced_ids << local.id
    rescue => e
      Rails.logger.warn("[CronSyncJob] Failed to sync job #{name}: #{e.message}")
    end

    # Log summary
    Rails.logger.info("[CronSyncJob] Synced #{synced_ids.size} of #{gateway_jobs.size} gateway cron jobs")
  end
end
