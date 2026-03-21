# Spawns a new OpenClaw sub-agent for an approved task.
# Called after user approves the plan in the planning modal.
class SpawnAgentJob < ApplicationJob
  queue_as :default

  def perform(task_id)
    task = Task.find_by(id: task_id)
    return unless task

    client = ::Openclaw::GatewayClient.new

    begin
      # Ask OpenClaw to create a sub-agent scoped to this task
      response = client.post("/api/agents/spawn", {
        name:        "task-#{task.id}-#{task.title.parameterize.truncate(30, omission: '')}",
        description: task.plan_content || task.description || task.title,
        parent:      "main",
        metadata: {
          task_id:    task.id,
          task_title: task.title,
          priority:   task.priority,
          source:     "crabbys-mission-control"
        }
      })

      agent_id = response["id"] || response["agent_id"] || response.dig("agent", "id")

      if agent_id
        task.update!(openclaw_agent_id: agent_id, agent_status: "spawned")
        ActionCable.server.broadcast("task_updates", {
          event:    "agent_spawned",
          task_id:  task.id,
          agent_id: agent_id
        })
        ::EventStore.emit(
          type:     "agent_spawned",
          message:  "Agent spawned for \"#{task.title}\" (#{agent_id})",
          agent_id: agent_id,
          metadata: { task_id: task.id }
        )
      end
    rescue ::Openclaw::GatewayError, Faraday::Error => e
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
