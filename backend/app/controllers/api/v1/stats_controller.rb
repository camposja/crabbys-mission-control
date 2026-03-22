module Api
  module V1
    # GET /api/v1/stats
    # Returns a summary snapshot for the dashboard header.
    class StatsController < BaseController
      def index
        # Agent count from OpenClaw (graceful fallback)
        agent_count = begin
          data = gateway.rpc("agents.list")
          agents = data.is_a?(Array) ? data : (data["agents"] || data["data"] || [])
          agents.length
        rescue
          nil
        end

        render json: {
          agents: {
            total:  agent_count,
            online: agent_count  # gateway doesn't distinguish online vs total yet
          },
          tasks: {
            backlog:     Task.by_status("backlog").count,
            in_progress: Task.by_status("in_progress").count,
            review:      Task.by_status("review").count,
            done:        Task.by_status("done").count,
            total:       Task.count
          },
          cron_jobs: {
            total:   CronJob.count,
            enabled: CronJob.enabled.count
          },
          projects: {
            total:  Project.count,
            active: Project.active.count
          },
          upcoming_events: CalendarEvent.upcoming.limit(3).count,
          generated_at:    Time.current.iso8601
        }
      end
    end
  end
end
