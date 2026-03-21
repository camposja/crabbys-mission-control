module Api
  module V1
    class ProjectsController < BaseController
      before_action :set_project, only: [:show, :update, :destroy]

      def index
        projects = Project.all.order(created_at: :desc)
        render json: projects.as_json(include: { tasks: { only: [:id, :title, :status] } })
      end

      def show
        render json: @project.as_json(include: :tasks)
      end

      def create
        project = Project.create!(project_params)
        render json: project, status: :created
      end

      def update
        @project.update!(project_params)
        render json: @project
      end

      def destroy
        @project.destroy!
        head :no_content
      end

      private

      def set_project
        @project = Project.find(params[:id])
      end

      def project_params
        params.require(:project).permit(:name, :description, :status, :color)
      end
    end
  end
end
