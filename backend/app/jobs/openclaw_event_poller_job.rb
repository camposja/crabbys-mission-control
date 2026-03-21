# Polls the OpenClaw gateway for new agent events and pushes them
# to the EventStore (which broadcasts via Action Cable).
#
# Scheduled via solid_queue recurring jobs (config/recurring.yml).
# Falls back gracefully if OpenClaw is unreachable.
class OpenclawEventPollerJob < ApplicationJob
  queue_as :default

  POLL_INTERVAL = 5.seconds

  def perform
    client = Openclaw::GatewayClient.new

    # Try to fetch recent events from the gateway
    begin
      data = client.get("/api/events/recent")
      events = Array.wrap(data["events"] || data)

      events.each do |ev|
        EventStore.emit(
          type:     ev["type"]     || "agent_event",
          message:  ev["message"]  || ev["content"] || ev.to_json,
          agent_id: ev["agent_id"] || ev["agentId"],
          metadata: ev.except("type", "message", "agent_id", "agentId", "content")
        )
      end
    rescue Openclaw::GatewayError, Faraday::Error => e
      # Don't flood the event feed with connection errors — just log
      Rails.logger.warn("[OpenclawEventPollerJob] Gateway unreachable: #{e.message}")
    end

    # Also push a heartbeat metric event so the dashboard shows "alive"
    SystemMetricsJob.perform_later
  end
end
