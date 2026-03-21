module Api
  module V1
    module Openclaw
      class SessionsController < BaseController
        def index
          data = gateway.get("/api/sessions")
          render json: data
        end
      end
    end
  end
end
