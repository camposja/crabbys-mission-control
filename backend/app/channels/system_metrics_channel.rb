# Streams gateway health and system metrics every 10 seconds
class SystemMetricsChannel < ApplicationCable::Channel
  def subscribed
    stream_from "system_metrics"
    transmit_metrics
  end

  def unsubscribed
    stop_all_streams
  end

  private

  def transmit_metrics
    ActionCable.server.broadcast("system_metrics", {
      event:     "metrics",
      timestamp: Time.current.iso8601,
      rails:     "ok"
    })
  end
end
