module Api
  module V1
    class HealthController < BaseController
      def index
        render json: {
          status: "ok",
          version: "0.1.0",
          ruby: RUBY_VERSION,
          rails: Rails.version,
          openclaw_gateway: gateway_status
        }
      end

      private

      def gateway_status
        gateway.get("/health")
        "connected"
      rescue
        "unreachable"
      end
    end
  end
end
