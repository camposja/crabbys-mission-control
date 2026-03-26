module Api
  module V1
    class TaskNotesController < BaseController
      before_action :set_task

      def index
        render json: @task.task_notes.ordered
      end

      def create
        note = @task.task_notes.create!(note_params)
        render json: note, status: :created
      end

      private

      def set_task
        @task = Task.find(params[:task_id])
      end

      def note_params
        params.require(:task_note).permit(:author, :body)
      end
    end
  end
end
