module Api
  module V1
    # GET  /api/v1/models       — list all configured models
    # GET  /api/v1/models/live  — list models currently available from gateway
    class ModelsController < BaseController
      def index
        providers = ::Openclaw::WorkspaceReader.models_config

        models = providers.flat_map do |provider_name, config|
          (config["models"] || []).map do |m|
            {
              id:             m["id"],
              name:           m["name"] || m["id"],
              provider:       provider_name,
              reasoning:      m["reasoning"] || false,
              context_window: m["contextWindow"],
              max_tokens:     m["maxTokens"],
              cost:           m["cost"],
              input_types:    m["input"] || ["text"]
            }
          end
        end

        # Also try to get live list from gateway
        gateway_models = begin
          gateway.get("/api/models")
        rescue
          []
        end

        render json: {
          configured: models,
          gateway:    gateway_models,
          defaults:   default_models_config
        }
      end

      def live
        data = gateway.get("/api/models")
        render json: data
      rescue => e
        render json: { error: e.message, models: [] }, status: :ok
      end

      private

      def default_models_config
        config_path = File.join(
          ENV.fetch("OPENCLAW_HOME", File.expand_path("~/.openclaw")),
          "openclaw.json"
        )
        return {} unless File.exist?(config_path)
        JSON.parse(File.read(config_path)).dig("agents", "defaults", "models") || {}
      rescue
        {}
      end
    end
  end
end
