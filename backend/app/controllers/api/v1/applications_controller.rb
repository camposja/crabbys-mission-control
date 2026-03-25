module Api
  module V1
    class ApplicationsController < BaseController
      def sync
        ApplicationSyncJob.perform_now
        render json: { synced: true, synced_at: Time.current.iso8601 }
      rescue => e
        render json: { error: e.message }, status: :internal_server_error
      end
    end
  end
end
