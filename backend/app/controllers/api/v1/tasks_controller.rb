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
        if task.project_id.present?
          ActionCable.server.broadcast("project_updates:#{task.project_id}", {
            event: "task_changed",
            project_id: task.project_id,
            task_id: task.id
          })
        end
        ::EventStore.emit(
          type:     "task_created",
          message:  "New task \"#{task.title}\" added to #{task.status}",
          agent_id: task.assignee,
          metadata: { task_id: task.id, status: task.status, priority: task.priority, project_id: task.project_id }
        )
        # Auto-create a calendar event when the task has a deadline
        if task.due_date.present?
          CalendarEvent.create!(
            title:      "Due: #{task.title}",
            starts_at:  task.due_date,
            event_type: "task_deadline",
            metadata:   { task_id: task.id }
          )
        end
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
      # Accepts either { column: } or { status: } from the frontend
      def move
        new_status = params[:column] || params[:status]
        old_status = @task.status
        @task.update!(status: new_status, position: params[:position] || 0)

        # Broadcast to Action Cable so the UI refreshes instantly
        ActionCable.server.broadcast("task_updates", {
          event:      "task_moved",
          task_id:    @task.id,
          task_title: @task.title,
          old_status: old_status,
          new_status: @task.status
        })

        if @task.project_id.present?
          ActionCable.server.broadcast("project_updates:#{@task.project_id}", {
            event: "task_changed",
            project_id: @task.project_id,
            task_id: @task.id
          })
        end

        # Push to EventStore so OpenClaw heartbeats can see task state changes
        ::EventStore.emit(
          type:     "task_moved",
          message:  "Task \"#{@task.title}\" moved from #{old_status} → #{new_status}",
          agent_id: @task.assignee,
          metadata: { task_id: @task.id, old_status: old_status, new_status: new_status, project_id: @task.project_id }
        )

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
