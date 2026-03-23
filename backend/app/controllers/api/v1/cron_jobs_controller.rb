module Api
  module V1
    class CronJobsController < BaseController
      before_action :set_cron_job, only: [:show, :update, :destroy, :toggle, :run_now]

      def index
        scope = CronJob.all
        scope = scope.where(project_id: params[:project_id]) if params[:project_id].present?
        render json: scope.order(:name)
      end

      def show
        render json: @cron_job
      end

      def create
        cron_job = CronJob.create!(cron_job_params)
        render json: cron_job, status: :created
      end

      def update
        @cron_job.update!(cron_job_params)
        render json: @cron_job
      end

      def destroy
        @cron_job.destroy!
        head :no_content
      end

      def toggle
        @cron_job.update!(enabled: !@cron_job.enabled)
        EventStore.emit(
          type:    "cron_job_toggled",
          message: "Cron job '#{@cron_job.name}' #{@cron_job.enabled? ? 'enabled' : 'disabled'}"
        )
        render json: @cron_job
      end

      def run_now
        @cron_job.update!(last_run_at: Time.current)
        EventStore.emit(
          type:    "cron_job_run_now",
          message: "Manual run requested for cron job '#{@cron_job.name}'"
        )
        render json: { queued: true }
      end

      private

      def set_cron_job
        @cron_job = CronJob.find(params[:id])
      end

      def cron_job_params
        params.require(:cron_job).permit(
          :name, :cron_expression, :command, :enabled,
          :task_id, :project_id, :agent_id,
          :gateway_reference
        )
      end
    end
  end
end
