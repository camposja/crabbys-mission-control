# Syncs scheduled work from the OpenClaw gateway into local CronJob and
# CalendarEvent records.  This is a verification layer — if the gateway
# doesn't expose schedule data we say so honestly rather than faking it.
#
# Usage:
#   result = Openclaw::CalendarSyncService.new.call
#   result[:gateway_available]           # => true / false
#   result[:gateway_supports_schedule]   # => true / false
#
module Openclaw
  class CalendarSyncService
    # RPC method names to try, in order.  We stop at the first that succeeds.
    SCHEDULE_RPC_METHODS = %w[schedule.list cron.list jobs.list].freeze

    def call
      errors  = []
      gateway = GatewayClient.new

      # --- 1. Probe the gateway for scheduled-job data ----------------------
      gateway_available          = false
      gateway_supports_schedule  = false
      raw_jobs                   = []

      SCHEDULE_RPC_METHODS.each do |method|
        begin
          data = gateway.rpc(method)
          gateway_available         = true
          gateway_supports_schedule = true
          raw_jobs = normalize_job_list(data)
          break
        rescue Openclaw::GatewayError => e
          # Record we at least reached the gateway if the error isn't a
          # connection-level failure (connection failures always raise with
          # "connection failed" or "timeout" in the message).
          gateway_available = true unless connection_error?(e)
          errors << "#{method}: #{e.message}"
        end
      end

      # --- 2. Reconcile CronJob records ------------------------------------
      synced_cron_jobs = 0
      cron_job_map     = {} # gateway_ref -> CronJob

      if gateway_supports_schedule
        raw_jobs.each do |raw|
          ref = raw["id"].to_s
          next if ref.blank?

          cron_job = CronJob.find_or_initialize_by(gateway_reference: ref)

          cron_job.assign_attributes(
            name:            raw["name"].presence || "Gateway job #{ref}",
            cron_expression: raw["cron_expression"].presence || raw["schedule"].presence || cron_job.cron_expression || "* * * * *",
            command:         raw["command"].presence || cron_job.command || "gateway-managed",
            enabled:         raw.fetch("enabled", true),
            status:          map_status(raw["status"]),
            last_run_at:     parse_time(raw["last_run_at"]),
            next_run_at:     parse_time(raw["next_run_at"]),
            synced_at:       Time.current,
            sync_source:     "gateway"
          )

          cron_job.save!
          cron_job_map[ref] = cron_job
          synced_cron_jobs += 1
        rescue ActiveRecord::RecordInvalid => e
          errors << "CronJob sync for ref=#{ref}: #{e.message}"
        end
      end

      # --- 3. Reconcile CalendarEvent records ------------------------------
      synced_events = 0

      if gateway_supports_schedule
        raw_jobs.each do |raw|
          ref       = raw["id"].to_s
          next_run  = parse_time(raw["next_run_at"])
          next if ref.blank? || next_run.nil?

          event = CalendarEvent.find_or_initialize_by(
            gateway_reference: ref,
            source:            "cron_job"
          )

          event.assign_attributes(
            title:       raw["name"].presence || "Scheduled: #{ref}",
            starts_at:   next_run,
            status:      next_run > Time.current ? "scheduled" : "completed",
            cron_job:    cron_job_map[ref],
            next_run_at: next_run,
            last_run_at: parse_time(raw["last_run_at"])
          )

          event.save!
          synced_events += 1
        rescue ActiveRecord::RecordInvalid => e
          errors << "CalendarEvent sync for ref=#{ref}: #{e.message}"
        end
      end

      # --- 4. Handle honest failure ----------------------------------------
      unless gateway_available
        EventStore.emit(
          type:    "calendar_sync_failed",
          message: "Calendar sync could not reach the OpenClaw gateway. " \
                   "Attempted RPC methods: #{SCHEDULE_RPC_METHODS.join(', ')}.",
          metadata: { errors: errors }
        )
      end

      # --- 5. Return result ------------------------------------------------
      {
        synced_cron_jobs:          synced_cron_jobs,
        synced_events:             synced_events,
        gateway_available:         gateway_available,
        gateway_supports_schedule: gateway_supports_schedule,
        errors:                    errors,
        synced_at:                 Time.current
      }
    end

    private

    # Normalize whatever shape the gateway returns into an Array of Hashes.
    def normalize_job_list(data)
      return data if data.is_a?(Array)
      return [] unless data.is_a?(Hash)

      data["jobs"] || data["schedules"] || data["cron_jobs"] || data["data"] || []
    end

    # Map gateway status strings to CronJob::STATUSES.
    def map_status(raw)
      case raw.to_s.downcase
      when "active", "running" then "active"
      when "paused", "disabled" then "paused"
      when "failed", "error"   then "failed"
      else "idle"
      end
    end

    def parse_time(value)
      return nil if value.blank?
      Time.parse(value.to_s)
    rescue ArgumentError
      nil
    end

    # Connection-level errors contain these substrings; everything else is an
    # RPC-level error (meaning the gateway is reachable but the method failed).
    CONNECTION_ERROR_PATTERNS = /connection failed|timeout|refused|reset|pipe/i

    def connection_error?(error)
      CONNECTION_ERROR_PATTERNS.match?(error.message)
    end
  end
end
