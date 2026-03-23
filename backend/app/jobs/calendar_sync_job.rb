# Periodically syncs scheduled work from the OpenClaw gateway into local
# CronJob / CalendarEvent records.  Runs every 5 minutes via recurring.yml.
class CalendarSyncJob < ApplicationJob
  queue_as :default

  def perform
    result = Openclaw::CalendarSyncService.new.call

    EventStore.emit(
      type:    "calendar_sync",
      message: "Calendar sync complete — " \
               "#{result[:synced_cron_jobs]} cron job(s), " \
               "#{result[:synced_events]} event(s), " \
               "gateway #{result[:gateway_available] ? 'reachable' : 'unreachable'}",
      metadata: result.except(:errors).merge(error_count: result[:errors].size)
    )

    ActionCable.server.broadcast("calendar_reminders", {
      event: "calendar_sync_completed",
      result: {
        synced_cron_jobs: result[:synced_cron_jobs],
        synced_events: result[:synced_events],
        gateway_available: result[:gateway_available],
        synced_at: result[:synced_at]
      }
    })

    # Sweep for overdue events and verify execution
    sweep_overdue_events

    Rails.logger.info("[CalendarSyncJob] #{result.inspect}")
  rescue StandardError => e
    Rails.logger.error("[CalendarSyncJob] Unexpected error: #{e.message}")
    EventStore.emit(
      type:    "calendar_sync_failed",
      message: "Calendar sync crashed: #{e.message}",
      metadata: { error_class: e.class.name }
    )
  end

  private

  def sweep_overdue_events
    overdue = CalendarEvent.where(status: "scheduled")
                           .where("starts_at < ?", 1.hour.ago)

    overdue.find_each do |event|
      result = Calendar::ExecutionVerifier.new(event).call

      if %w[missed failed completed].include?(result[:suggested_status])
        event.update_columns(
          status: result[:suggested_status],
          verified_at: Time.current,
          verification_source: result[:verification_source],
          execution_detail: result[:detail]
        )
        EventStore.emit(
          type: "calendar_event_#{result[:suggested_status]}",
          message: "Calendar event \"#{event.title}\" marked #{result[:suggested_status]} by verifier",
          metadata: { calendar_event_id: event.id, verification_source: result[:verification_source] }
        )
      end
    end
  rescue StandardError => e
    Rails.logger.error("[CalendarSyncJob] Overdue sweep error: #{e.message}")
  end
end
