module Api
  module V1
    # GET /api/v1/integration_check
    #
    # Runs live end-to-end probes against the OpenClaw gateway and reports
    # which paths actually work.
    #
    # The gateway communicates exclusively via WebSocket JSON-RPC.
    # The only HTTP endpoint is GET /health.
    #
    # Each check returns:
    #   name        — human label
    #   key         — machine key
    #   ok          — boolean
    #   detail      — what we found or why it failed
    #   raw         — first 500 chars of the raw gateway response (for debugging)
    class IntegrationCheckController < BaseController
      def index
        client = ::Openclaw::GatewayClient.new
        checks = [
          check_auth(client),
          check_health(client),
          check_sessions(client),
          check_agents(client),
          check_message_path(client),
          check_spawn_readiness(client),
          check_event_stream(client),
        ]

        all_ok = checks.all? { |c| c[:ok] }
        render json: {
          overall:    all_ok ? "ok" : "degraded",
          checked_at: Time.current.iso8601,
          gateway:    ::Openclaw::GatewayClient::BASE_URL,
          auth_token_configured: ENV["OPENCLAW_GATEWAY_TOKEN"].present?,
          checks:     checks
        }
      end

      private

      # 1. Auth / token scope
      # Verifies the token is set and that the gateway accepts it via WebSocket handshake.
      def check_auth(client)
        token = ENV["OPENCLAW_GATEWAY_TOKEN"]
        unless token.present?
          return { name: "Auth / Token", key: "auth", ok: false,
                   detail: "OPENCLAW_GATEWAY_TOKEN is not set. RPC calls will fail.",
                   raw: nil }
        end

        # Test that the WebSocket connect + auth handshake succeeds
        # by calling the lightweight "health" RPC method.
        start = now
        client.rpc("health")
        { name: "Auth / Token", key: "auth", ok: true,
          detail: "Token present and accepted by gateway via WebSocket RPC (#{elapsed(start)}ms)",
          raw: nil }
      rescue ::Openclaw::GatewayError => e
        { name: "Auth / Token", key: "auth", ok: false,
          detail: "WebSocket auth failed: #{e.message}", raw: nil }
      end

      # 2. Health endpoint (HTTP — the one endpoint that works over HTTP)
      def check_health(client)
        start    = now
        data     = client.health
        latency  = elapsed(start)
        { name: "Gateway Health (HTTP)", key: "health", ok: true,
          detail: "HTTP /health responded in #{latency}ms",
          raw: truncate(data) }
      rescue => e
        { name: "Gateway Health (HTTP)", key: "health", ok: false, detail: e.message, raw: nil }
      end

      # 3. Session listing via RPC
      def check_sessions(client)
        data     = client.rpc("sessions.list")
        sessions = if data.is_a?(Array)
                     data
                   else
                     Array.wrap(data["sessions"] || data["data"] || [])
                   end
        { name: "Session Listing (RPC)", key: "sessions", ok: true,
          detail: "#{sessions.size} session(s) returned via sessions.list RPC",
          raw: truncate(data) }
      rescue => e
        { name: "Session Listing (RPC)", key: "sessions", ok: false, detail: e.message, raw: nil }
      end

      # 4. Agent listing via RPC
      def check_agents(client)
        data   = client.rpc("agents.list")
        agents = if data.is_a?(Array)
                   data
                 else
                   Array.wrap(data["agents"] || data["data"] || [])
                 end
        main   = agents.find { |a| a["id"] == "main" || a["name"] == "main" }
        detail = "#{agents.size} agent(s) returned via agents.list RPC"
        detail += main ? " — main agent found" : " — WARNING: main agent not in list"
        { name: "Agent Listing (RPC)", key: "agents", ok: true,
          detail: detail,
          raw: truncate(data) }
      rescue => e
        { name: "Agent Listing (RPC)", key: "agents", ok: false, detail: e.message, raw: nil }
      end

      # 5. Message send path via chat.send RPC
      def check_message_path(client)
        data = client.chat_send(
          content:    "[integration-check] Mission Control probe #{Time.current.iso8601}",
          agent_id:   "main",
          session_id: "mission-control-integration-probe"
        )
        { name: "Message Send Path (RPC)", key: "message", ok: true,
          detail: "Message accepted by gateway via chat.send RPC",
          raw: truncate(data) }
      rescue => e
        { name: "Message Send Path (RPC)", key: "message", ok: false, detail: e.message, raw: nil }
      end

      # 6. Spawn readiness
      # There is NO spawn RPC method in OpenClaw. This is a documented gap.
      # We report this clearly rather than probing a nonexistent endpoint.
      def check_spawn_readiness(_client)
        { name: "Agent Spawn Readiness", key: "spawn", ok: false,
          detail: "No spawn RPC method exists in the OpenClaw gateway. " \
                  "Sub-agent creation must be requested via chat.send to the main agent. " \
                  "This is a known protocol gap.",
          raw: nil }
      end

      # 7. Event stream via logs.tail or status RPC
      def check_event_stream(client)
        data = client.rpc("logs.tail")
        entries = if data.is_a?(Array)
                    data
                  else
                    Array.wrap(data["events"] || data["logs"] || data["entries"] || [])
                  end
        detail = "#{entries.size} log entry/entries returned via logs.tail RPC"
        if entries.any? && entries.first.is_a?(Hash)
          shapes = entries.first(3).map { |e| e.keys.sort.join(",") }
          detail += " — sample keys: #{shapes.first}" if shapes.any?
        end
        { name: "Event Stream (RPC)", key: "events", ok: true,
          detail: detail,
          raw: truncate(data) }
      rescue => e
        # Fall back to status RPC
        begin
          data = client.rpc("status")
          { name: "Event Stream (RPC)", key: "events", ok: true,
            detail: "logs.tail failed but status RPC succeeded",
            raw: truncate(data) }
        rescue => e2
          { name: "Event Stream (RPC)", key: "events", ok: false,
            detail: "logs.tail: #{e.message}; status: #{e2.message}", raw: nil }
        end
      end

      def now
        Process.clock_gettime(Process::CLOCK_MONOTONIC)
      end

      def elapsed(start)
        ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start) * 1000).round
      end

      def truncate(data)
        data.to_json.slice(0, 500)
      end
    end
  end
end
