# Runs on a schedule (every 5 minutes via recurring.yml).
# Checks the backlog for tasks assigned to Crabby and nudges OpenClaw
# to pick them up — mirroring the heartbeat behaviour described in the Bootcamp.
#
# Uses `chat.send` RPC (replaces old HTTP POST /api/message).
class HeartbeatCheckJob < ApplicationJob
  queue_as :default

  def perform
    crabby_tasks = Task.for_crabby.ordered

    if crabby_tasks.any?
      # Build a compact summary for the heartbeat prompt
      task_list = crabby_tasks.map do |t|
        "- [#{t.status.upcase}] task_id=#{t.id} | #{t.title} (priority: #{t.priority || 'medium'})"
      end.join("\n")

      webhook_url = "#{mc_url}/api/v1/openclaw/webhook"
      webhook_token = ENV["MISSION_CONTROL_WEBHOOK_TOKEN"]
      auth_header_line = webhook_token.present? ? "\n        Required header: X-Mission-Control-Token: #{webhook_token}" : ""

      message = <<~MSG
        HEARTBEAT CHECK — Mission Control task board update.

        You have #{crabby_tasks.count} active task(s) assigned to you:

        #{task_list}

        Review your backlog and pick up any tasks you can action now.

        Webhook instructions (use task_id as the canonical key):
        Endpoint: POST #{webhook_url}#{auth_header_line}

        When STARTING a task:  {"event_type": "agent_status", "task_id": "<task_id>", "agent_id": "<your-id>", "status": "started"}
        When COMPLETING a task: {"event_type": "agent_completed", "task_id": "<task_id>", "agent_id": "<your-id>"}
        When a task FAILS:      {"event_type": "agent_failed", "task_id": "<task_id>", "agent_id": "<your-id>", "message": "<details>"}

        Other endpoints:
        To update a task status: PATCH #{mc_url}/api/v1/tasks/:id/move with { column: "in_progress" }
        To view the full board: GET #{mc_url}/api/v1/board
      MSG

      begin
        client = ::Openclaw::GatewayClient.new
        client.chat_send(
          content:    message,
          agent_id:   "main",
          session_id: "heartbeat-tasks"
        )
      rescue ::Openclaw::GatewayError => e
        Rails.logger.warn("[HeartbeatCheckJob] Could not notify OpenClaw: #{e.message}")
      end

      ::EventStore.emit(
        type:    "heartbeat",
        message: "Heartbeat: #{crabby_tasks.count} task(s) in Crabby's queue",
        metadata: { task_count: crabby_tasks.count }
      )
    end
  end

  private

  def mc_url
    ENV.fetch("MISSION_CONTROL_URL", "http://localhost:3000")
  end
end
