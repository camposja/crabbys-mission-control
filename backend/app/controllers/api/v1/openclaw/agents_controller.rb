module Api
  module V1
    module Openclaw
      class AgentsController < BaseController
        def index
          data = gateway.rpc("agents.list")
          render json: data
        end

        def show
          # agents.list returns all; filter by id
          all = gateway.rpc("agents.list")
          agents = Array.wrap(all.is_a?(Array) ? all : (all["agents"] || all["data"] || []))
          agent = agents.find { |a| a["id"] == params[:id] }
          if agent
            render json: agent
          else
            render json: { error: "Agent not found" }, status: :not_found
          end
        end
      end
    end
  end
end
