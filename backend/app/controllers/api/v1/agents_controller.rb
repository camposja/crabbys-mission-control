module Api
  module V1
    class AgentsController < BaseController
      # GET /api/v1/agents
      # Merges local agent configs with live gateway data
      def index
        local_agents = ::Openclaw::WorkspaceReader.list_local_agents

        gateway_agents = begin
          data = gateway.rpc("agents.list")
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
          # agents.list returns all agents; filter for the one we want.
          # There is also agent.identity.get but agents.list is more reliable.
          all = gateway.rpc("agents.list")
          agents = Array.wrap(all.is_a?(Array) ? all : (all["agents"] || all["data"] || []))
          agents.find { |a| a["id"] == agent_id } || {}
        rescue
          {}
        end

        local = ::Openclaw::WorkspaceReader.list_local_agents.find { |a| a[:id] == agent_id } || {}
        render json: local.merge(data)
      end

      # POST /api/v1/agents/:id/pause
      # NOTE: No known RPC method for pause. This is a documented gap.
      # The gateway does not expose an agent pause/resume/terminate RPC.
      def pause
        render json: {
          error: "Agent pause is not supported by the OpenClaw gateway RPC protocol. " \
                 "No pause RPC method exists. This is a known gap.",
          agent_id: params[:id]
        }, status: :not_implemented
      end

      # POST /api/v1/agents/:id/resume
      # NOTE: No known RPC method for resume. This is a documented gap.
      def resume
        render json: {
          error: "Agent resume is not supported by the OpenClaw gateway RPC protocol. " \
                 "No resume RPC method exists. This is a known gap.",
          agent_id: params[:id]
        }, status: :not_implemented
      end

      # DELETE /api/v1/agents/:id
      # NOTE: No known RPC method for terminate. This is a documented gap.
      def terminate
        render json: {
          error: "Agent terminate is not supported by the OpenClaw gateway RPC protocol. " \
                 "No terminate RPC method exists. This is a known gap.",
          agent_id: params[:id]
        }, status: :not_implemented
      end
    end
  end
end
