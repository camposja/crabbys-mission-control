module Api
  module V1
    class JobApplicationsController < BaseController
      before_action :ensure_job_applications_ready!, only: [:index, :create, :update, :grouped_by_date, :sync]
      before_action :sync_assistant_records!, only: [:index, :grouped_by_date]

      def index
        return render json: [] unless job_applications_ready?

        render json: filtered_scope.as_json
      end

      def create
        return render json: { error: "Job applications feature is not ready. Run migrations first." }, status: :service_unavailable unless job_applications_ready?

        application = JobApplication.new(job_application_params)
        application.source ||= "manual"
        application.external_uid ||= SecureRandom.uuid
        application.save!

        render json: application, status: :created
      end

      def update
        return render json: { error: "Job applications feature is not ready. Run migrations first." }, status: :service_unavailable unless job_applications_ready?

        application = JobApplication.find(params[:id])
        application.update!(job_application_params)
        render json: application
      end

      def sync
        return render json: { files_scanned: 0, records_seen: 0, records_upserted: 0, source_path: nil, warning: "Job applications feature is not ready. Run migrations first." }, status: :service_unavailable unless job_applications_ready?

        result = JobApplicationsSyncService.call(with_stats: true)
        render json: result
      end

      def grouped_by_date
        return render json: [] unless job_applications_ready?

        applications = filtered_scope
        grouped = applications.group_by(&:applied_on)

        render json: grouped.map { |date, applications|
          {
            date: date,
            total: applications.size,
            counts: {
              applied: applications.count { |a| a.status == "applied" },
              pending: applications.count { |a| a.status == "pending" },
              started: applications.count { |a| a.status == "started" },
              assistant: applications.count(&:assistant?),
              manual: applications.count(&:manual?)
            },
            job_applications: applications.map(&:as_json)
          }
        }
      end

      private

      def ensure_job_applications_ready!
        return if job_applications_ready?
      rescue StandardError => e
        Rails.logger.warn("JobApplicationsController readiness check failed: #{e.class}: #{e.message}")
      end

      def sync_assistant_records!
        return unless job_applications_ready?

        JobApplicationsSyncService.call
      rescue StandardError => e
        Rails.logger.warn("JobApplicationsController sync failed: #{e.class}: #{e.message}")
      end

      def filtered_scope
        scope = JobApplication.recent_first
        scope = scope.where(status: params[:status]) if params[:status].present?
        scope = scope.where(source: params[:source]) if params[:source].present?
        scope = scope.where("applied_on >= ?", Date.parse(params[:from])) if params[:from].present?
        scope = scope.where("applied_on <= ?", Date.parse(params[:to])) if params[:to].present?
        scope = scope.for_date(params[:applied_on]) if params[:applied_on].present?
        scope
      rescue ArgumentError
        scope
      end

      def job_applications_ready?
        defined?(JobApplication) && JobApplication.table_exists?
      end

      def job_application_params
        permitted = params.require(:job_application).permit(
          :title,
          :company,
          :location,
          :url,
          :status,
          :source,
          :applied_on,
          :notes,
          :external_uid,
          external_data: {}
        )

        permitted[:source] ||= "manual"
        permitted[:status] ||= "applied"
        permitted[:external_data] ||= {}
        permitted
      end
    end
  end
end
