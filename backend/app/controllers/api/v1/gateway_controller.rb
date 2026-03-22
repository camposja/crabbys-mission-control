module Api
  module V1
    # GET /api/v1/gateway
    # Returns OpenClaw gateway health details.
    # Uses the HTTP GET /health endpoint (the one HTTP route that works).
    class GatewayController < BaseController
      def show
        start = Process.clock_gettime(Process::CLOCK_MONOTONIC)

        begin
          data     = gateway.health
          elapsed  = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start) * 1000).round
          render json: {
            status:       "connected",
            latency_ms:   elapsed,
            gateway_url:  ENV.fetch("OPENCLAW_GATEWAY_URL", "http://localhost:18789"),
            response:     data,
            checked_at:   Time.current.iso8601
          }
        rescue Openclaw::GatewayError, Faraday::Error => e
          render json: {
            status:      "unreachable",
            error:       e.message,
            gateway_url: ENV.fetch("OPENCLAW_GATEWAY_URL", "http://localhost:18789"),
            checked_at:  Time.current.iso8601
          }, status: :ok  # return 200 so the frontend can show the error gracefully
        end
      end
    end
  end
end
