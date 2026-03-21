module Api
  module V1
    class CalendarEventsController < BaseController
      before_action :set_event, only: [:show, :update, :destroy]

      def index
        events = if params[:from] && params[:to]
          CalendarEvent.for_range(params[:from], params[:to])
        else
          CalendarEvent.upcoming.limit(50)
        end
        render json: events
      end

      def show
        render json: @event
      end

      def create
        event = CalendarEvent.create!(event_params)
        ActionCable.server.broadcast("agent_events", { event: "calendar_event_created", data: event.as_json })
        render json: event, status: :created
      end

      def update
        @event.update!(event_params)
        render json: @event
      end

      def destroy
        @event.destroy!
        head :no_content
      end

      private

      def set_event
        @event = CalendarEvent.find(params[:id])
      end

      def event_params
        params.require(:calendar_event).permit(:title, :description, :starts_at, :ends_at, :event_type, :recurrence, metadata: {})
      end
    end
  end
end
