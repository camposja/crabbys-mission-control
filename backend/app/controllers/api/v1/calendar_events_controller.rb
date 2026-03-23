module Api
  module V1
    class CalendarEventsController < BaseController
      before_action :set_event, only: [:show, :update, :destroy]

      # NOTE: This returns raw AR JSON (no nested task/project).
      # CalendarController#events returns a richer serialized shape with nested associations.
      # The frontend CalendarPage uses CalendarController; this endpoint is for programmatic/CRUD use.
      def index
        events = if params[:from] && params[:to]
          CalendarEvent.for_range(params[:from], params[:to])
        else
          CalendarEvent.upcoming.limit(50)
        end

        events = events.where(task_id: params[:task_id])       if params[:task_id].present?
        events = events.where(project_id: params[:project_id]) if params[:project_id].present?
        events = events.where(agent_id: params[:agent_id])     if params[:agent_id].present?
        events = events.where(source: params[:source])         if params[:source].present?
        events = events.where(status: params[:status])         if params[:status].present?

        render json: events
      end

      def show
        render json: @event
      end

      def create
        event = CalendarEvent.create!(event_params)
        ActionCable.server.broadcast("agent_events", { event: "calendar_event_created", data: event.as_json })
        ActionCable.server.broadcast("calendar_reminders", { event: "calendar_event_created", data: event.as_json })
        render json: event, status: :created
      end

      def update
        @event.update!(event_params)
        ActionCable.server.broadcast("calendar_reminders", { event: "calendar_event_updated", data: @event.as_json })
        render json: @event
      end

      def destroy
        @event.destroy!
        ActionCable.server.broadcast("calendar_reminders", { event: "calendar_event_deleted", data: { id: params[:id] } })
        head :no_content
      end

      private

      def set_event
        @event = CalendarEvent.find(params[:id])
      end

      def event_params
        params.require(:calendar_event).permit(
          :title, :description, :starts_at, :ends_at, :event_type, :recurrence,
          :task_id, :project_id, :agent_id, :cron_job_id,
          :source, :status, :gateway_reference, :next_run_at,
          metadata: {}
        )
      end
    end
  end
end
