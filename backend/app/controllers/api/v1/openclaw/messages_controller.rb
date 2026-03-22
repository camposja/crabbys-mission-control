module Api
  module V1
    module Openclaw
      class MessagesController < BaseController
        def create
          data = gateway.chat_send(
            content:    message_params[:content],
            agent_id:   message_params[:agent_id] || "main",
            session_id: message_params[:session_id] || "main"
          )
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
