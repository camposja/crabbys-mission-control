module Api
  module V1
    class MissionStatementsController < BaseController
      def show
        ms = MissionStatement.current
        render json: ms || { content: nil }
      end

      def update
        ms = MissionStatement.current || MissionStatement.new
        ms.update!(content: params.require(:mission_statement)[:content], updated_by: "user")
        render json: ms
      end
    end
  end
end
