module Api
  module V1
    module Openclaw
      # POST /api/v1/openclaw/webhook
      #
      # Inbound endpoint for the OpenClaw gateway to push events into Mission Control.
      # This closes the "task status sync" gap — instead of Mission Control only ever
      # polling, OpenClaw can call this whenever an agent completes, fails, or changes state.
      #
      # Supported event_type values:
      #   agent_completed   — agent finished its work successfully
      #   agent_failed      — agent hit an unrecoverable error
      #   agent_status      — generic status update (use status: field)
      #   task_update       — explicit task column move (use task_id: and column: fields)
      #   message           — free-form message to surface in the event feed
      #
      # The gateway does NOT need to send a token for this endpoint because it is
      # localhost-only (RAILS_BIND=127.0.0.1). If that changes, add token auth here.
      class WebhookController < BaseController
        # Skip any future auth middleware for inbound gateway calls
        skip_before_action :verify_authenticity_token, raise: false

        def create
          event_type = params[:event_type].to_s
          agent_id   = params[:agent_id].to_s.presence
          task_id    = params[:task_id].to_s.presence
          message    = params[:message].to_s.presence
          status     = params[:status].to_s.presence
          column     = params[:column].to_s.presence

          # Resolve the task — by explicit task_id or by openclaw_agent_id
          task = resolve_task(task_id, agent_id)

          case event_type
          when "agent_completed"
            handle_agent_completed(task, agent_id, message)
          when "agent_failed"
            handle_agent_failed(task, agent_id, message)
          when "agent_status"
            handle_agent_status(task, agent_id, status, message)
          when "task_update"
            handle_task_update(task, column, agent_id, message)
          else
            # Surface as a generic event in the feed
            EventStore.emit(
              type:     event_type.presence || "webhook_event",
              message:  message || params.to_unsafe_h.to_json,
              agent_id: agent_id,
              metadata: { task_id: task&.id, raw: params.to_unsafe_h.except("controller", "action") }
            )
          end

          render json: { received: true, task_id: task&.id }
        end

        private

        def resolve_task(task_id, agent_id)
          return Task.find_by(id: task_id) if task_id.present?
          return Task.find_by(openclaw_agent_id: agent_id) if agent_id.present?
          nil
        end

        def handle_agent_completed(task, agent_id, message)
          if task
            task.update_columns(agent_status: "completed", status: "done")
            ActionCable.server.broadcast("task_updates", {
              event:      "task_moved",
              task_id:    task.id,
              task_title: task.title,
              old_status: task.status_before_last_save,
              new_status: "done",
              source:     "agent_webhook"
            })
          end
          EventStore.emit(
            type:     "agent_completed",
            message:  message || "Agent #{agent_id} completed#{task ? " task \"#{task.title}\"" : ""}",
            agent_id: agent_id,
            metadata: { task_id: task&.id }
          )
        end

        def handle_agent_failed(task, agent_id, message)
          task&.update_columns(agent_status: "failed")
          EventStore.emit(
            type:     "agent_failed",
            message:  message || "Agent #{agent_id} failed#{task ? " on task \"#{task.title}\"" : ""}",
            agent_id: agent_id,
            metadata: { task_id: task&.id }
          )
        end

        def handle_agent_status(task, agent_id, status, message)
          return unless status.present?
          task&.update_columns(agent_status: status)
          EventStore.emit(
            type:     "agent_status_updated",
            message:  message || "Agent #{agent_id} → #{status}",
            agent_id: agent_id,
            metadata: { task_id: task&.id, agent_status: status }
          )
        end

        def handle_task_update(task, column, agent_id, message)
          return render json: { error: "task not found" }, status: :not_found unless task
          return render json: { error: "column required" }, status: :unprocessable_entity unless column.present?

          old_status = task.status
          task.update!(status: column)

          ActionCable.server.broadcast("task_updates", {
            event:      "task_moved",
            task_id:    task.id,
            task_title: task.title,
            old_status: old_status,
            new_status: column,
            source:     "agent_webhook"
          })
          EventStore.emit(
            type:     "task_moved",
            message:  message || "Task \"#{task.title}\" moved to #{column} by agent #{agent_id}",
            agent_id: agent_id,
            metadata: { task_id: task.id, old_status: old_status, new_status: column }
          )
        end
      end
    end
  end
end
