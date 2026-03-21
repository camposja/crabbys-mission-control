module Api
  module V1
    module Openclaw
      class MessagesController < BaseController
        def create
          data = gateway.post("/api/message", message_params)
          render json: data, status: :created
        end

        private

        def message_params
          params.require(:message).permit(:agent_id, :content, :session_id)
        end
      end
    end
  end
end
