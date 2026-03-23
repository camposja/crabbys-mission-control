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

    Rails.logger.info("[CalendarSyncJob] #{result.inspect}")
  rescue StandardError => e
    Rails.logger.error("[CalendarSyncJob] Unexpected error: #{e.message}")
    EventStore.emit(
      type:    "calendar_sync_failed",
      message: "Calendar sync crashed: #{e.message}",
      metadata: { error_class: e.class.name }
    )
  end
end
