module Api
  module V1
    class CronJobsController < BaseController
      before_action :set_cron_job, only: [:show, :update, :destroy, :toggle, :run_now]

      # GET /api/v1/cron_jobs
      # Default: read live from the OpenClaw gateway (source of truth).
      # Fallback: if gateway is unreachable, serve from local DB.
      # Pass ?source=local to force DB-only.
      def index
        if params[:source] == "local"
          render_local_jobs
        else
          render_gateway_jobs
        end
      end

      # POST /api/v1/cron_jobs/sync
      # Manual sync: pulls gateway cron jobs and upserts into local DB for
      # project linking, historical tracking, and offline fallback.
      def sync
        jobs = fetch_gateway_jobs
        if jobs.nil?
          return render json: { error: "Gateway unreachable" }, status: :bad_gateway
        end

        synced = 0
        jobs.each do |gj|
          gateway_id = gj["id"] || gj["jobId"]
          schedule   = gj["schedule"] || {}
          state      = gj["state"] || {}

          cron_expr = case schedule["kind"]
                      when "cron"  then schedule["expr"]
                      when "every" then "every #{(schedule['everyMs'].to_i / 1000)}s"
                      when "at"    then "at #{schedule['at']}"
                      else schedule.to_s.truncate(100)
                      end

          local = CronJob.find_or_initialize_by(gateway_reference: gateway_id)
          local.assign_attributes(
            name:            gj["name"] || gateway_id,
            cron_expression: cron_expr || "unknown",
            command:         "gateway-managed",
            enabled:         gj.fetch("enabled", true),
            status:          gj.fetch("enabled", true) ? "active" : "idle",
            next_run_at:     state["nextRunAtMs"] ? Time.at(state["nextRunAtMs"] / 1000.0) : nil,
            last_run_at:     state["lastRunAtMs"] ? Time.at(state["lastRunAtMs"] / 1000.0) : nil,
            failure_count:   state["consecutiveErrors"] || 0,
            sync_source:     "gateway",
            synced_at:       Time.current
          )
          local.save! if local.changed?
          synced += 1
        rescue => e
          Rails.logger.warn("[CronJobsController#sync] Failed to sync #{gj['name']}: #{e.message}")
        end

        render json: { synced: synced, total: jobs.size, synced_at: Time.current.iso8601 }
      end

      def show
        render json: @cron_job
      end

      def create
        cron_job = CronJob.create!(cron_job_params)
        ActionCable.server.broadcast("calendar_reminders", {
          event: "cron_job_updated",
          cron_job: { id: cron_job.id, name: cron_job.name, enabled: cron_job.enabled, status: cron_job.status }
        })
        render json: cron_job, status: :created
      end

      def update
        @cron_job.update!(cron_job_params)
        broadcast_cron_job_update("cron_job_updated")
        render json: @cron_job
      end

      def destroy
        cron_job_data = { id: @cron_job.id, name: @cron_job.name }
        @cron_job.destroy!
        ActionCable.server.broadcast("calendar_reminders", {
          event: "cron_job_destroyed",
          cron_job: cron_job_data
        })
        head :no_content
      end

      def toggle
        @cron_job.update!(enabled: !@cron_job.enabled)
        EventStore.emit(
          type:    "cron_job_toggled",
          message: "Cron job '#{@cron_job.name}' #{@cron_job.enabled? ? 'enabled' : 'disabled'}"
        )
        broadcast_cron_job_update("cron_job_updated")
        render json: @cron_job
      end

      def run_now
        @cron_job.update!(last_run_at: Time.current)
        EventStore.emit(
          type:    "cron_job_run_now",
          message: "Manual run requested for cron job '#{@cron_job.name}'"
        )
        broadcast_cron_job_update("cron_job_updated")
        render json: { queued: true }
      end

      private

      def render_gateway_jobs
        jobs = fetch_gateway_jobs
        if jobs.nil?
          # Gateway unreachable — fall back to local DB
          Rails.logger.warn("[CronJobsController] Gateway unreachable, falling back to local DB")
          return render_local_jobs
        end

        rendered = jobs.map { |gj| normalize_gateway_job(gj) }
        render json: rendered
      end

      def render_local_jobs
        scope = CronJob.all
        scope = scope.where(project_id: params[:project_id]) if params[:project_id].present?
        render json: scope.order(:name)
      end

      def fetch_gateway_jobs
        client = ::Openclaw::GatewayClient.new
        data = client.rpc("cron.list")
        raw = data.is_a?(Array) ? data : (data["jobs"] || data["data"] || [])
        Array.wrap(raw)
      rescue ::Openclaw::GatewayError => e
        Rails.logger.warn("[CronJobsController] Gateway RPC failed: #{e.message}")
        nil
      end

      def normalize_gateway_job(gj)
        schedule = gj["schedule"] || {}
        state    = gj["state"] || {}
        delivery = gj["delivery"] || {}

        cron_expr = case schedule["kind"]
                    when "cron"  then schedule["expr"]
                    when "every" then "every #{(schedule['everyMs'].to_i / 1000)}s"
                    when "at"    then "at #{schedule['at']}"
                    else nil
                    end

        {
          id:              gj["id"] || gj["jobId"],
          name:            gj["name"] || gj["id"],
          cron_expression: cron_expr,
          schedule_kind:   schedule["kind"],
          schedule_tz:     schedule["tz"],
          schedule_raw:    schedule,
          enabled:         gj.fetch("enabled", true),
          status:          gj.fetch("enabled", true) ? "active" : "disabled",
          next_run_at:     state["nextRunAtMs"] ? Time.at(state["nextRunAtMs"] / 1000.0).iso8601 : nil,
          last_run_at:     state["lastRunAtMs"] ? Time.at(state["lastRunAtMs"] / 1000.0).iso8601 : nil,
          last_run_status: state["lastRunStatus"],
          last_delivery:   state["lastDeliveryStatus"],
          failure_count:   state["consecutiveErrors"] || 0,
          delivery_mode:   delivery["mode"],
          source:          "gateway"
        }
      end

      def set_cron_job
        @cron_job = CronJob.find(params[:id])
      end

      def broadcast_cron_job_update(event_name)
        ActionCable.server.broadcast("calendar_reminders", {
          event: event_name,
          cron_job: {
            id: @cron_job.id,
            name: @cron_job.name,
            enabled: @cron_job.enabled,
            last_run_at: @cron_job.last_run_at,
            next_run_at: @cron_job.next_run_at,
            status: @cron_job.status
          }
        })
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
