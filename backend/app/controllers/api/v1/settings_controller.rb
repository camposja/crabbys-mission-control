module Api
  module V1
    class SettingsController < BaseController
      def show
        render json: Setting.all.pluck(:key, :value).to_h
      end

      def update
        submitted = params.require(:settings)
        rejected  = submitted.keys.map(&:to_s) - Setting::ALLOWED_KEYS
        if rejected.any?
          return render json: {
            error: "Unknown setting(s): #{rejected.sort.join(', ')}",
            allowed: Setting::ALLOWED_KEYS
          }, status: :unprocessable_entity
        end

        settings_params.each { |key, value| Setting.set(key, value) }
        render json: Setting.all.pluck(:key, :value).to_h
      end

      private

      # Reviewed allowlist rather than `permit!` — see Setting::ALLOWED_KEYS.
      def settings_params
        params.require(:settings).permit(*Setting::ALLOWED_KEYS).to_h
      end
    end
  end
end
