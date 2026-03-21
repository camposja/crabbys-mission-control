module Api
  module V1
    class TasksController < BaseController
      before_action :set_task, only: [:show, :update, :destroy, :move]

      def index
        tasks = Task.ordered
        tasks = tasks.by_status(params[:status]) if params[:status].present?
        tasks = tasks.where(project_id: params[:project_id]) if params[:project_id].present?
        render json: tasks.group_by(&:status)
      end

      def show
        render json: @task
      end

      def create
        task = Task.new(task_params)
        task.position = Task.where(status: task.status).count
        task.save!
        ActionCable.server.broadcast("task_updates", { event: "task_created", task: task.as_json })
        render json: task, status: :created
      end

      def update
        @task.update!(task_params)
        render json: @task
      end

      def destroy
        @task.destroy!
        ActionCable.server.broadcast("task_updates", { event: "task_deleted", task_id: @task.id })
        head :no_content
      end

      # PATCH /tasks/:id/move — move a card to a new column
      def move
        old_status = @task.status
        @task.update!(status: params[:status], position: params[:position] || 0)
        ActionCable.server.broadcast("task_updates", {
          event:      "task_moved",
          task_id:    @task.id,
          old_status: old_status,
          new_status: @task.status
        })
        render json: @task
      end

      private

      def set_task
        @task = Task.find(params[:id])
      end

      def task_params
        params.require(:task).permit(:title, :description, :status, :priority, :assignee, :project_id, :position, :due_date, metadata: {})
      end
    end
  end
end
