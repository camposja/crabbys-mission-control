# Streams Kanban task moves and updates to the React frontend
class TaskUpdatesChannel < ApplicationCable::Channel
  def subscribed
    stream_from "task_updates"
  end

  def unsubscribed
    stop_all_streams
  end
end
