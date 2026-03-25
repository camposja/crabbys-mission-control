module Api
  module V1
    class ProjectsController < BaseController
      before_action :set_project, only: [:show, :update, :destroy, :summary, :activity]

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

      def activity
        limit = (params[:limit] || 20).to_i.clamp(1, 50)
        events = EventStore.recent(200).select do |event|
          event[:metadata]&.dig("project_id") == @project.id ||
            event[:metadata]&.dig(:project_id) == @project.id
        end.first(limit)

        render json: {
          project_id: @project.id,
          project_name: @project.name,
          events: events,
          total: events.size
        }
      end

      def summary
        counts = @project.tasks.group(:status).count
        total = counts.values.sum
        tasks_by_status = {
          "backlog" => 0,
          "in_progress" => 0,
          "review" => 0,
          "done" => 0
        }.merge(counts)
        done_count = tasks_by_status["done"]
        completion_percentage = total > 0 ? (done_count.to_f / total * 100).round : 0

        render json: {
          project_id: @project.id,
          project_name: @project.name,
          total_tasks: total,
          tasks_by_status: tasks_by_status,
          completion_percentage: completion_percentage
        }
      end

      private

      def set_project
        @project = Project.find(params[:id])
      end

      def project_params
        params.require(:project).permit(:name, :description, :status, :color, :telegram_thread_id, :telegram_thread_name)
      end
    end
  end
end
