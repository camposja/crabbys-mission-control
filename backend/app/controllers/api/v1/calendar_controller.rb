module Api
  module V1
    class CalendarController < BaseController
      # GET /api/v1/calendar
      def index
        render json: {
          upcoming_events: upcoming_events.map { |e| serialize_event(e) },
          active_cron_jobs: CronJob.enabled.order(:name).map { |cj| serialize_cron_job(cj) },
          summary: build_summary
        }
      end

      # GET /api/v1/calendar/events
      def events
        start_date = params[:start_date].present? ? Time.parse(params[:start_date]) : Time.current.beginning_of_day
        end_date   = params[:end_date].present?   ? Time.parse(params[:end_date])   : 30.days.from_now

        scope = CalendarEvent.for_range(start_date, end_date).order(:starts_at)
        scope = scope.where(agent_id: params[:agent_id])     if params[:agent_id].present?
        scope = scope.where(task_id: params[:task_id])        if params[:task_id].present?
        scope = scope.where(project_id: params[:project_id])  if params[:project_id].present?

        if params[:status].present?
          unless CalendarEvent::STATUSES.include?(params[:status])
            return render json: { error: "Invalid status. Must be one of: #{CalendarEvent::STATUSES.join(', ')}" },
                          status: :unprocessable_entity
          end
          scope = scope.where(status: params[:status])
        end

        render json: scope.map { |e| serialize_event(e) }
      end

      # GET /api/v1/calendar/cron_jobs
      def cron_jobs
        render json: CronJob.all.order(:name).map { |cj| serialize_cron_job(cj) }
      end

      # GET /api/v1/calendar/summary
      def summary
        render json: build_summary
      end

      # GET /api/v1/calendar/today
      def today
        date = Date.current
        events = CalendarEvent
          .where("DATE(starts_at) = ?", date)
          .order(:starts_at)
          .includes(:task, :project)
        render json: {
          date: date.iso8601,
          events: events.map { |e| serialize_event(e) },
          cron_occurrences: cron_occurrences_for_range(date.beginning_of_day, date.end_of_day)
        }
      end

      # GET /api/v1/calendar/week
      def week
        week_start = params[:week_start].present? ? Date.parse(params[:week_start]).beginning_of_week(:sunday) : Date.current.beginning_of_week(:sunday)
        week_end   = week_start + 6.days
        events = CalendarEvent
          .where("DATE(starts_at) BETWEEN ? AND ?", week_start, week_end)
          .order(:starts_at)
          .includes(:task, :project)
        render json: {
          week_start: week_start.iso8601,
          week_end:   week_end.iso8601,
          events:     events.map { |e| serialize_event(e) },
          cron_occurrences: cron_occurrences_for_range(week_start.beginning_of_day, week_end.end_of_day)
        }
      end

      # GET /api/v1/calendar/events/:id/history
      def history
        event = CalendarEvent.find(params[:id])
        result = Calendar::ExecutionVerifier.new(event).call

        render json: {
          event: serialize_event_with_verification(event.reload),
          verification: {
            verified:            result[:verified],
            suggested_status:    result[:suggested_status],
            verification_source: result[:verification_source],
            detail:              result[:detail],
            checked_at:          result[:checked_at]&.iso8601
          },
          task: result[:task],
          relevant_events: result[:relevant_events]
        }
      end

      private

      def upcoming_events
        CalendarEvent.upcoming.limit(10).includes(:task, :project)
      end

      def build_summary
        now = Time.current
        {
          total_scheduled: CalendarEvent.where(status: "scheduled").count,
          upcoming_24h:    CalendarEvent.where(status: "scheduled")
                                        .where(starts_at: now..24.hours.from_now)
                                        .count,
          running:         CalendarEvent.where(status: "running").count,
          failed:          CalendarEvent.where(status: "failed").count,
          missed:          CalendarEvent.where(status: "missed").count,
          cancelled:       CalendarEvent.where(status: "cancelled").count,
          completed_today: CalendarEvent.where(status: "completed")
                                        .where(updated_at: now.beginning_of_day..now.end_of_day)
                                        .count,
          active_cron_jobs: CronJob.enabled.count,
          checked_at:       now.iso8601,
          gateway_sync: {
            last_synced_at:             CronJob.where.not(synced_at: nil).maximum(:synced_at)&.iso8601,
            gateway_supports_schedule:  CronJob.where(sync_source: "gateway").exists?,
            local_only_cron_jobs:       CronJob.where(sync_source: [nil, "local", "manual"]).count,
            gateway_synced_cron_jobs:   CronJob.where(sync_source: "gateway").count
          }
        }
      end

      def serialize_event(event)
        {
          id:                event.id,
          title:             event.title,
          description:       event.description,
          starts_at:         event.starts_at&.iso8601,
          ends_at:           event.ends_at&.iso8601,
          status:            event.status,
          source:            event.source,
          agent_id:          event.agent_id,
          task_id:           event.task_id,
          project_id:        event.project_id,
          cron_job_id:       event.cron_job_id,
          gateway_reference: event.gateway_reference,
          last_run_at:       event.last_run_at&.iso8601,
          next_run_at:       event.next_run_at&.iso8601,
          task:              event.task ? { id: event.task.id, title: event.task.title } : nil,
          project:           event.project ? { id: event.project.id, title: event.project.name } : nil
        }
      end

      def serialize_event_with_verification(event)
        serialize_event(event).merge(
          run_attempts:       event.run_attempts,
          verified_at:        event.verified_at&.iso8601,
          verification_source: event.verification_source,
          execution_detail:   event.execution_detail
        )
      end

      def cron_occurrences_for_range(start_time, end_time)
        CronJob.where(enabled: true).includes(:task, :project).filter_map do |job|
          if job.next_run_at && job.next_run_at.between?(start_time, end_time)
            {
              id: "cron-#{job.id}",
              cron_job_id: job.id,
              title: job.name,
              starts_at: job.next_run_at.iso8601,
              status: job.status || "scheduled",
              source: "cron_job",
              cron_expression: job.cron_expression,
              agent_id: job.agent_id,
              task_id: job.task_id,
              project_id: job.project_id,
              task: job.task ? { id: job.task.id, title: job.task.title } : nil,
              project: job.project ? { id: job.project.id, title: job.project.name } : nil
            }
          end
        end
      end

      def serialize_cron_job(cron_job)
        {
          id:                cron_job.id,
          name:              cron_job.name,
          cron_expression:   cron_job.cron_expression,
          enabled:           cron_job.enabled,
          status:            cron_job.status,
          last_run_at:       cron_job.last_run_at&.iso8601,
          next_run_at:       cron_job.next_run_at&.iso8601,
          failure_count:     cron_job.failure_count,
          last_error:        cron_job.last_error,
          agent_id:          cron_job.agent_id,
          task_id:           cron_job.task_id,
          project_id:        cron_job.project_id,
          gateway_reference: cron_job.gateway_reference,
          task:              cron_job.task ? { id: cron_job.task.id, title: cron_job.task.title } : nil,
          project:           cron_job.project ? { id: cron_job.project.id, title: cron_job.project.name } : nil
        }
      end
    end
  end
end
