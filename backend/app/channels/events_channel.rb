# Master event channel — broadcasts all agent actions, system events, and metrics.
# React subscribes here for the live event feed.
class EventsChannel < ApplicationCable::Channel
  def subscribed
    stream_from "events:all"

    # Optionally scope to a specific agent
    if params[:agent_id].present?
      stream_from "events:agent:#{params[:agent_id]}"
    end
  end

  def unsubscribed
    stop_all_streams
  end

  # Client can request a replay of the last N events
  def replay(data)
    count = data["count"].to_i.clamp(1, 100)
    recent = EventStore.recent(count)
    recent.each { |ev| transmit(ev) }
  end
end
