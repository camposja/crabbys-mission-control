# Polls the OpenClaw gateway for the current status of each spawned agent
# and syncs it back to the corresponding Task record.
#
# This closes the gap where agent_status would stay forever at "spawned" after
# SpawnAgentJob ran. Runs every 30 seconds via recurring.yml.
#
# Uses `agents.list` RPC then filters by agent ID (no per-agent RPC exists).
class AgentStatusSyncJob < ApplicationJob
  queue_as :default

  # Map OpenClaw agent states -> our agent_status column values
  TERMINAL_STATES = %w[done completed finished].freeze
  FAILED_STATES   = %w[failed error crashed].freeze

  STATUS_MAP = {
    "running"   => "running",
    "active"    => "running",
    "working"   => "running",
    "paused"    => "paused",
    "idle"      => "idle",
    "done"      => "completed",
    "completed" => "completed",
    "finished"  => "completed",
    "failed"    => "failed",
    "error"     => "failed",
    "crashed"   => "failed",
  }.freeze

  STALE_THRESHOLD = 15.minutes
  SPAWN_TIMEOUT   = 15.minutes

  def perform
    # Find tasks that have a linked agent but haven't reached a terminal state
    tasks = Task.where.not(openclaw_agent_id: nil)
                .where.not(agent_status: %w[completed failed spawn_failed])

    # Detect and recover orphaned tasks (no agent_id linked)
    recover_orphaned_tasks

    # Detect tasks stuck in active states for too long
    detect_stale_tasks(tasks)

    return if tasks.none?

    client = Openclaw::GatewayClient.new

    # Fetch all agents once, then look up each task's agent
    all_agents = begin
      data = client.rpc("agents.list")
      Array.wrap(data.is_a?(Array) ? data : (data["agents"] || data["data"] || []))
    rescue Openclaw::GatewayError => e
      Rails.logger.warn("[AgentStatusSyncJob] Gateway unreachable: #{e.message}")
      return
    end

    tasks.each do |task|
      agent_data = all_agents.find { |a| a["id"] == task.openclaw_agent_id }
      sync_task(task, agent_data || {})
    end
  end

  private

  def sync_task(task, data)
    status = extract_status(data)
    return if status.nil? || status == task.agent_status

    new_status = STATUS_MAP[status] || status
    updates    = { agent_status: new_status }

    # When the agent finishes, move the task card to done — but NEVER auto-close recurring tasks
    if TERMINAL_STATES.include?(status) && task.status != "done" && task.status != "recurring"
      updates[:status] = "done"
      ActionCable.server.broadcast("task_updates", {
        event:      "task_moved",
        task_id:    task.id,
        task_title: task.title,
        old_status: task.status,
        new_status: "done",
        source:     "agent_completion"
      })
    end

    if FAILED_STATES.include?(status)
      EventStore.emit(
        type:     "agent_failed",
        message:  "Agent for \"#{task.title}\" reported failure",
        agent_id: task.openclaw_agent_id,
        metadata: { task_id: task.id, agent_status: new_status, raw: data }
      )
    end

    task.update_columns(updates)

    EventStore.emit(
      type:     "agent_status_updated",
      message:  "Agent for \"#{task.title}\" -> #{new_status}",
      agent_id: task.openclaw_agent_id,
      metadata: { task_id: task.id, agent_status: new_status }
    )
  rescue Openclaw::GatewayError => e
    # Agent may have been cleaned up; don't crash the whole job
    Rails.logger.warn("[AgentStatusSyncJob] Could not process agent #{task.openclaw_agent_id}: #{e.message}")
  end

  def extract_status(data)
    return nil unless data.is_a?(Hash)
    # Gateway may return { status: }, { state: }, or { agent: { status: } }
    data["status"] || data["state"] ||
      data.dig("agent", "status") || data.dig("agent", "state")
  end

  # Tasks in spawn_requested/running/in_progress with no openclaw_agent_id.
  # If stuck in spawn_requested for >SPAWN_TIMEOUT, mark as spawn_failed.
  # Otherwise, log a warning and nudge the agent.
  def recover_orphaned_tasks
    orphaned = Task.where(openclaw_agent_id: nil)
                   .where(agent_status: %w[spawn_requested running in_progress])

    orphaned.each do |task|
      age = Time.current - (task.state_changed_at || task.updated_at)

      if task.agent_status == "spawn_requested" && age > SPAWN_TIMEOUT
        # Spawn likely failed silently — no agent ever called back
        task.update_columns(agent_status: "spawn_failed")
        Rails.logger.error(
          "[AgentStatusSyncJob] Task #{task.id} (\"#{task.title}\") stuck in spawn_requested " \
          "for #{(age / 60).round}min with no agent_id — marking spawn_failed"
        )
        EventStore.emit(
          type:     "spawn_failed",
          message:  "Task \"#{task.title}\" spawn timed out — no agent responded after #{(age / 60).round}min",
          metadata: { task_id: task.id, project_id: task.project_id, agent_status: "spawn_failed" }
        )
        ActionCable.server.broadcast("task_updates", {
          event:      "agent_status_changed",
          task_id:    task.id,
          task_title: task.title,
          old_status: "spawn_requested",
          new_status: "spawn_failed",
          source:     "stale_detection"
        })
      else
        Rails.logger.warn(
          "[AgentStatusSyncJob] Task #{task.id} (\"#{task.title}\") is #{task.agent_status} but has no openclaw_agent_id — " \
          "waiting for agent to call back via webhook with task_id (age: #{(age / 60).round}min)"
        )
      end
    end
  end

  # Tasks with a linked agent that have been in a non-terminal state too long.
  # Emit a warning event so operators can see them in the dashboard.
  def detect_stale_tasks(tasks)
    tasks.each do |task|
      age = Time.current - task.updated_at
      next unless age > STALE_THRESHOLD

      Rails.logger.warn(
        "[AgentStatusSyncJob] Task #{task.id} (\"#{task.title}\") appears stale — " \
        "agent_status=#{task.agent_status}, last update #{(age / 60).round}min ago"
      )
      EventStore.emit(
        type:     "task_stale",
        message:  "Task \"#{task.title}\" may be stuck — agent #{task.openclaw_agent_id} " \
                  "has been #{task.agent_status} for #{(age / 60).round}min with no update",
        agent_id: task.openclaw_agent_id,
        metadata: { task_id: task.id, project_id: task.project_id,
                    agent_status: task.agent_status, stale_minutes: (age / 60).round }
      )
    end
  end
end
