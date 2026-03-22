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
      spawn_prompt = <<~MSG
        SPAWN SUB-AGENT REQUEST from Mission Control.

        Please create a sub-agent scoped to the following task:
        - Task ID: #{task.id}
        - Title: #{task.title}
        - Priority: #{task.priority || "medium"}
        - Description: #{task.plan_content || task.description || task.title}

        Suggested agent name: #{agent_name}
        Source: crabbys-mission-control
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
        metadata: { task_id: task.id }
      )
    rescue ::Openclaw::GatewayError => e
      # Gateway unreachable — mark as pending so user knows to retry
      task.update!(agent_status: "spawn_failed")
      Rails.logger.error("[SpawnAgentJob] Failed to spawn agent for task #{task_id}: #{e.message}")
      ::EventStore.emit(
        type:     "error",
        message:  "Failed to spawn agent for \"#{task.title}\": #{e.message}",
        metadata: { task_id: task.id }
      )
    end
  end
end
