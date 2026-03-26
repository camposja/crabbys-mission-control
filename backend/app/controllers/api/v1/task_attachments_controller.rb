module Api
  module V1
    class TaskAttachmentsController < BaseController
      before_action :set_task

      def index
        render json: @task.task_attachments.order(created_at: :desc)
      end

      def create
        attachment = @task.task_attachments.create!(attachment_params)
        render json: attachment, status: :created
      end

      def destroy
        attachment = @task.task_attachments.find(params[:id])
        attachment.destroy!
        head :no_content
      end

      private

      def set_task
        @task = Task.find(params[:task_id])
      end

      def attachment_params
        params.require(:task_attachment).permit(:filename, :content, :uploaded_by)
      end
    end
  end
end
