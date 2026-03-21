# Streams upcoming calendar events to the React frontend
class CalendarRemindersChannel < ApplicationCable::Channel
  def subscribed
    stream_from "calendar_reminders"
    transmit_upcoming
  end

  def unsubscribed
    stop_all_streams
  end

  private

  def transmit_upcoming
    upcoming = CalendarEvent.upcoming.limit(5)
    ActionCable.server.broadcast("calendar_reminders", {
      event:  "upcoming_events",
      events: upcoming.as_json
    })
  end
end
