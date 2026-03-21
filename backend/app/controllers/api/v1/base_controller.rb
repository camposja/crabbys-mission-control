module Api
  module V1
    class BaseController < ApplicationController
      before_action :set_default_format

      rescue_from StandardError, with: :render_internal_error
      rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
      rescue_from ActiveRecord::RecordInvalid, with: :render_unprocessable
      rescue_from ::Openclaw::GatewayError, with: :render_gateway_error

      private

      def set_default_format
        request.format = :json
      end

      def render_not_found(e)
        render json: { error: e.message }, status: :not_found
      end

      def render_unprocessable(e)
        render json: { error: e.message }, status: :unprocessable_entity
      end

      def render_internal_error(e)
        Rails.logger.error e.full_message
        render json: { error: "Internal server error" }, status: :internal_server_error
      end

      def render_gateway_error(e)
        render json: { error: e.message }, status: :bad_gateway
      end

      def gateway
        @gateway ||= ::Openclaw::GatewayClient.new
      end
    end
  end
end
