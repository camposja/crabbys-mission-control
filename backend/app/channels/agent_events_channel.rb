# Streams real-time agent activity to the React frontend
class AgentEventsChannel < ApplicationCable::Channel
  def subscribed
    stream_from "agent_events"
  end

  def unsubscribed
    stop_all_streams
  end
end
