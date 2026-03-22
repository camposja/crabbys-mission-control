# Spawns a new OpenClaw sub-agent for an approved task.
# Called after user approves the plan in the planning modal.
#
# NOTE: There is NO spawn RPC method in the OpenClaw gateway. This is a known gap.
# The job attempts chat.send as a workaround to ask the main agent to spawn a sub-agent,
# but marks spawn_failed if the gateway doesn't support it.
class SpawnAgentJob < ApplicationJob
  queue_as :default

  def perform(task_id)
    task = Task.find_by(id: task_id)
    return unless task

    client = ::Openclaw::GatewayClient.new

    begin
      # There is no agents.spawn RPC method in OpenClaw.
      # As a workaround, send a chat message to the main agent asking it to
      # create a sub-agent for this task.
      agent_name = "task-#{task.id}-#{task.title.parameterize.truncate(30, omission: '')}"
      webhook_url = "#{ENV.fetch('MISSION_CONTROL_URL', 'http://localhost:3000')}/api/v1/openclaw/webhook"
      webhook_token = ENV["MISSION_CONTROL_WEBHOOK_TOKEN"]
      auth_header_instruction = webhook_token.present? ? "\n        Header: X-Mission-Control-Token: #{webhook_token}" : ""

      spawn_prompt = <<~MSG
        SPAWN SUB-AGENT REQUEST from Mission Control.

        Please create a sub-agent scoped to the following task:

        === TASK (machine-readable) ===
        task_id: #{task.id}
        title: #{task.title}
        priority: #{task.priority || "medium"}
        description: #{task.plan_content || task.description || task.title}
        suggested_agent_name: #{agent_name}
        source: crabbys-mission-control
        === END TASK ===

        IMPORTANT — Webhook callbacks required:
        The sub-agent MUST call back to Mission Control at each lifecycle stage.
        Webhook URL: #{webhook_url}#{auth_header_instruction}

        1. When the agent STARTS work, POST:
           {"event_type": "agent_status", "task_id": "#{task.id}", "agent_id": "<your-agent-id>", "status": "started"}

        2. When the agent COMPLETES work, POST:
           {"event_type": "agent_completed", "task_id": "#{task.id}", "agent_id": "<your-agent-id>"}

        3. If the agent FAILS, POST:
           {"event_type": "agent_failed", "task_id": "#{task.id}", "agent_id": "<your-agent-id>", "message": "<error details>"}

        The task_id field is REQUIRED in all callbacks. It is the canonical key for linking agents to tasks.
      MSG

      response = client.chat_send(
        content:    spawn_prompt,
        agent_id:   "main",
        session_id: "spawn-#{task.id}"
      )

      # We can't reliably get an agent_id back from a chat message,
      # so mark the task as "spawn_requested" rather than "spawned".
      task.update!(agent_status: "spawn_requested")
      ActionCable.server.broadcast("task_updates", {
        event:    "spawn_requested",
        task_id:  task.id,
        detail:   "Spawn request sent via chat.send (no native spawn RPC available)"
      })
      ::EventStore.emit(
        type:     "spawn_requested",
        message:  "Spawn requested for \"#{task.title}\" via chat (no native spawn RPC)",
        metadata: { task_id: task.id, project_id: task.project_id }
      )
    rescue ::Openclaw::GatewayError => e
      # Gateway unreachable — mark as pending so user knows to retry
      task.update!(agent_status: "spawn_failed")
      Rails.logger.error("[SpawnAgentJob] Failed to spawn agent for task #{task_id}: #{e.message}")
      ::EventStore.emit(
        type:     "error",
        message:  "Failed to spawn agent for \"#{task.title}\": #{e.message}",
        metadata: { task_id: task.id, project_id: task.project_id }
      )
    end
  end
end
