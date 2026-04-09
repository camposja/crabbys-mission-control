module Api
  module V1
    class LinksController < BaseController
      before_action :set_link, only: [:destroy]

      def index
        links = Link.recent_first
        links = links.for_project(params[:project_id]) if params[:project_id].present?
        links = links.for_task(params[:task_id]) if params[:task_id].present?
        render json: links
      end

      def create
        link = Link.create!(link_params)
        render json: link, status: :created
      end

      def destroy
        @link.destroy!
        head :no_content
      end

      private

      def set_link
        @link = Link.find(params[:id])
      end

      def link_params
        params.require(:link).permit(:project_id, :task_id, :url, :title, :source_type, :notes)
      end
    end
  end
end
