module Api
  module V1
    class CronJobsController < BaseController
      before_action :set_cron_job, only: [:show, :update, :destroy]

      def index
        render json: CronJob.all.order(:name)
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

      private

      def set_cron_job
        @cron_job = CronJob.find(params[:id])
      end

      def cron_job_params
        params.require(:cron_job).permit(:name, :schedule, :command, :enabled)
      end
    end
  end
end
