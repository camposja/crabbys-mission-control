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

      # POST /api/v1/mission_statement/suggest
      # Asks OpenClaw to propose a mission statement based on the user's context
      def suggest
        context = build_context
        prompt  = <<~PROMPT
          Based on the user's recent work context below, suggest a concise and inspiring
          mission statement (1-2 sentences) for their personal Mission Control dashboard.
          It should reflect their goals, the tools they use and the kind of work they do.
          Respond with just the mission statement text — no quotes, no preamble.

          Context:
          #{context}
        PROMPT

        begin
          response = gateway.chat_send(
            content:    prompt,
            agent_id:   "main",
            session_id: "mission-suggest"
          )
          suggestion = response.dig("message", "content") || response["content"] || ""
          render json: { suggestion: suggestion.strip }
        rescue => e
          render json: { suggestion: nil, error: e.message }
        end
      end

      private

      def build_context
        lines = []
        lines << "Active tasks: #{Task.by_status('in_progress').pluck(:title).first(5).join(', ')}"
        lines << "Active projects: #{Project.active.pluck(:name).first(3).join(', ')}"
        lines << "Current mission: #{MissionStatement.current&.content || 'not set'}"
        lines.join("\n")
      end
    end
  end
end
