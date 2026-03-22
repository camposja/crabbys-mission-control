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
      class WebhookController < BaseController
        # Skip any future auth middleware for inbound gateway calls
        skip_before_action :verify_authenticity_token, raise: false
        before_action :verify_webhook_token

        def create
          event_type = params[:event_type].to_s
          agent_id   = params[:agent_id].to_s.presence
          task_id    = params[:task_id].to_s.presence
          message    = params[:message].to_s.presence
          status     = params[:status].to_s.presence
          column     = params[:column].to_s.presence

          # Resolve the task — task_id is the primary key; fall back to openclaw_agent_id
          task = resolve_task(task_id, agent_id)

          unless task
            Rails.logger.warn(
              "[Webhook] Could not resolve task — task_id=#{task_id.inspect}, agent_id=#{agent_id.inspect}, event_type=#{event_type}"
            )
          end

          case event_type
          when "agent_completed"
            handle_agent_completed(task, agent_id, message)
          when "agent_failed"
            handle_agent_failed(task, agent_id, message)
          when "agent_status"
            if status == "started" && task && agent_id
              handle_agent_started(task, agent_id, message)
            else
              handle_agent_status(task, agent_id, status, message)
            end
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

          response_body = { received: true, task_id: task&.id }
          unless ENV["MISSION_CONTROL_WEBHOOK_TOKEN"].present?
            response_body[:warning] = "Webhook authentication is disabled. Set MISSION_CONTROL_WEBHOOK_TOKEN to secure this endpoint."
          end
          render json: response_body
        end

        private

        def verify_webhook_token
          expected_token = ENV["MISSION_CONTROL_WEBHOOK_TOKEN"]
          return unless expected_token.present?

          provided_token = request.headers["X-Mission-Control-Token"]
          unless ActiveSupport::SecurityUtils.secure_compare(provided_token.to_s, expected_token)
            render json: { error: "Unauthorized" }, status: :unauthorized
          end
        end

        def resolve_task(task_id, agent_id)
          # task_id is the canonical bridge key — always prefer it
          return Task.find_by(id: task_id) if task_id.present?
          return Task.find_by(openclaw_agent_id: agent_id) if agent_id.present?
          nil
        end

        def handle_agent_started(task, agent_id, message)
          task.update_columns(openclaw_agent_id: agent_id, agent_status: "running")
          ActionCable.server.broadcast("task_updates", {
            event:      "agent_started",
            task_id:    task.id,
            task_title: task.title,
            agent_id:   agent_id,
            source:     "agent_webhook"
          })
          EventStore.emit(
            type:     "agent_started",
            message:  message || "Agent #{agent_id} started working on \"#{task.title}\"",
            agent_id: agent_id,
            metadata: { task_id: task.id }
          )
        end

        def handle_agent_completed(task, agent_id, message)
          if task
            updates = { agent_status: "completed", status: "done" }
            updates[:openclaw_agent_id] = agent_id if agent_id.present? && task.openclaw_agent_id.blank?
            task.update_columns(updates)
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
          if task
            updates = { agent_status: "failed" }
            updates[:openclaw_agent_id] = agent_id if agent_id.present? && task.openclaw_agent_id.blank?
            task.update_columns(updates)
          end
          EventStore.emit(
            type:     "agent_failed",
            message:  message || "Agent #{agent_id} failed#{task ? " on task \"#{task.title}\"" : ""}",
            agent_id: agent_id,
            metadata: { task_id: task&.id }
          )
        end

        def handle_agent_status(task, agent_id, status, message)
          return unless status.present?
          if task
            updates = { agent_status: status }
            updates[:openclaw_agent_id] = agent_id if agent_id.present? && task.openclaw_agent_id.blank?
            task.update_columns(updates)
          end
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
