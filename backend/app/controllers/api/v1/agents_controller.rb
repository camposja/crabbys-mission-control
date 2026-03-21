module Api
  module V1
    class AgentsController < BaseController
      # GET /api/v1/agents
      # Merges local agent configs with live gateway data
      def index
        local_agents = ::Openclaw::WorkspaceReader.list_local_agents

        gateway_agents = begin
          data = gateway.get("/api/agents")
          Array.wrap(data.is_a?(Array) ? data : (data["agents"] || data["data"] || []))
        rescue
          []
        end

        # Merge: gateway data wins for status/model fields
        merged = local_agents.map do |local|
          live = gateway_agents.find { |g| g["id"] == local[:id] || g["name"] == local[:name] }
          local.merge(
            status:      live&.dig("status") || "unknown",
            model:       live&.dig("model")  || local[:model],
            description: live&.dig("description"),
            channels:    live&.dig("channels") || [],
            current_task: live&.dig("currentTask") || live&.dig("current_task"),
            subagents:   live&.dig("subagents") || []
          )
        end

        # Add any gateway agents not found locally
        gateway_only = gateway_agents.reject { |g| local_agents.any? { |l| l[:id] == g["id"] } }
        gateway_only.each do |g|
          merged << {
            id:          g["id"],
            name:        g["name"] || g["id"],
            status:      g["status"] || "unknown",
            model:       g["model"],
            description: g["description"],
            channels:    g["channels"] || [],
            current_task: g["currentTask"] || g["current_task"],
            subagents:   g["subagents"] || [],
            local:       false
          }
        end

        render json: merged
      end

      # GET /api/v1/agents/:id
      def show
        agent_id = params[:id]
        data = begin
          gateway.get("/api/agents/#{agent_id}")
        rescue
          {}
        end

        local = ::Openclaw::WorkspaceReader.list_local_agents.find { |a| a[:id] == agent_id } || {}
        render json: local.merge(data)
      end

      # POST /api/v1/agents/:id/pause
      def pause
        result = gateway.post("/api/agents/#{params[:id]}/pause", {})
        ::EventStore.emit(type: "agent_paused", message: "Agent #{params[:id]} paused", agent_id: params[:id])
        render json: result
      rescue => e
        render json: { error: e.message }, status: :bad_gateway
      end

      # POST /api/v1/agents/:id/resume
      def resume
        result = gateway.post("/api/agents/#{params[:id]}/resume", {})
        ::EventStore.emit(type: "agent_resumed", message: "Agent #{params[:id]} resumed", agent_id: params[:id])
        render json: result
      rescue => e
        render json: { error: e.message }, status: :bad_gateway
      end

      # DELETE /api/v1/agents/:id
      def terminate
        result = gateway.post("/api/agents/#{params[:id]}/terminate", {})
        ::EventStore.emit(type: "agent_terminated", message: "Agent #{params[:id]} terminated", agent_id: params[:id])
        render json: result
      rescue => e
        render json: { error: e.message }, status: :bad_gateway
      end
    end
  end
end
