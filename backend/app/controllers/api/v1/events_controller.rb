module Api
  module V1
    class EventsController < BaseController
      # GET /api/v1/events/recent
      # Returns the last N events from the in-memory store for initial page load.
      def recent
        count  = (params[:count] || 50).to_i.clamp(1, 200)
        render json: EventStore.recent(count)
      end
    end
  end
end
