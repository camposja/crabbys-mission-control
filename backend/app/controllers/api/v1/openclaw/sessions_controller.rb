module Api
  module V1
    module Openclaw
      class SessionsController < BaseController
        def index
          data = gateway.rpc("sessions.list")
          render json: data
        end
      end
    end
  end
end
