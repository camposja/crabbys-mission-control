# Thin wrapper around the local OpenClaw HTTP gateway (default: http://localhost:18789)
# Auth: Bearer token from OPENCLAW_GATEWAY_TOKEN env var
module Openclaw
  class GatewayClient
    BASE_URL = ENV.fetch("OPENCLAW_GATEWAY_URL", "http://localhost:18789")

    def initialize
      @conn = Faraday.new(url: BASE_URL) do |f|
        f.request  :json
        f.response :json
        f.adapter  Faraday.default_adapter
      end
    end

    def get(path, params = {})
      response = @conn.get(path, params) { |req| authorize(req) }
      handle(response)
    end

    def post(path, body = {})
      response = @conn.post(path) do |req|
        authorize(req)
        req.body = body
      end
      handle(response)
    end

    private

    def authorize(req)
      token = ENV["OPENCLAW_GATEWAY_TOKEN"]
      req.headers["Authorization"] = "Bearer #{token}" if token.present?
    end

    def handle(response)
      raise GatewayError, "OpenClaw gateway error: #{response.status}" unless response.success?
      response.body
    end
  end

  class GatewayError < StandardError; end
end
