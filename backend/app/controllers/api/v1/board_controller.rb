module Api
  module V1
    # GET /api/v1/board
    # Machine-readable snapshot of the full Kanban board.
    # Designed so OpenClaw heartbeats can poll this and pick up assigned tasks.
    class BoardController < BaseController
      def index
        tasks = Task.ordered.group_by(&:status)

        render json: {
          board:        tasks,
          summary: {
            backlog:     tasks["backlog"]&.length     || 0,
            in_progress: tasks["in_progress"]&.length || 0,
            review:      tasks["review"]&.length      || 0,
            done:        tasks["done"]&.length        || 0,
          },
          assigned_to_crabby: Task.where(assignee: "crabby")
                                  .where.not(status: "done")
                                  .ordered
                                  .as_json(only: [:id, :title, :status, :priority, :description]),
          generated_at: Time.current.iso8601
        }
      end
    end
  end
end
