module Api
  module V1
    class SettingsController < BaseController
      def show
        render json: Setting.all.pluck(:key, :value).to_h
      end

      def update
        settings_params.each do |key, value|
          Setting.set(key, value)
        end
        render json: Setting.all.pluck(:key, :value).to_h
      end

      private

      def settings_params
        params.require(:settings).permit!.to_h
      end
    end
  end
end
