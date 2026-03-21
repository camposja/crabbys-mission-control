module Api
  module V1
    module Openclaw
      class AgentsController < BaseController
        def index
          data = gateway.get("/api/agents")
          render json: data
        end

        def show
          data = gateway.get("/api/agents/#{params[:id]}")
          render json: data
        end
      end
    end
  end
end
