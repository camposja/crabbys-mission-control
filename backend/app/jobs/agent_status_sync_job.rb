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

  def perform
    # Find tasks that have a linked agent but haven't reached a terminal state
    tasks = Task.where.not(openclaw_agent_id: nil)
                .where.not(agent_status: %w[completed failed spawn_failed])

    # Warn about tasks that are in_progress / spawn_requested but have no agent linked yet.
    # These may have an agent working them that hasn't called back with its ID.
    orphaned = Task.where(openclaw_agent_id: nil)
                   .where(agent_status: %w[spawn_requested running in_progress])
    orphaned.each do |t|
      Rails.logger.warn(
        "[AgentStatusSyncJob] Task #{t.id} (\"#{t.title}\") is #{t.agent_status} but has no openclaw_agent_id — " \
        "waiting for agent to call back via webhook with task_id"
      )
    end

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

    # When the agent finishes, move the task card to done unless it's already there
    if TERMINAL_STATES.include?(status) && task.status != "done"
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
end
