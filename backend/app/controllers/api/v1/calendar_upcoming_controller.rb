module Api
  module V1
    # GET /api/v1/calendar/upcoming
    # Returns the next N calendar events for the dashboard summary.
    class CalendarUpcomingController < BaseController
      def index
        limit  = (params[:limit] || 5).to_i.clamp(1, 20)
        events = CalendarEvent.upcoming.limit(limit)
        render json: events
      end
    end
  end
end
