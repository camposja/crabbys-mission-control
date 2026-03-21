# Runs on a schedule (every 5 minutes via recurring.yml).
# Checks the backlog for tasks assigned to Crabby and nudges OpenClaw
# to pick them up — mirroring the heartbeat behaviour described in the Bootcamp.
class HeartbeatCheckJob < ApplicationJob
  queue_as :default

  def perform
    crabby_tasks = Task.for_crabby.ordered

    if crabby_tasks.any?
      # Build a compact summary for the heartbeat prompt
      task_list = crabby_tasks.map do |t|
        "- [#{t.status.upcase}] #{t.title} (priority: #{t.priority || 'medium'})"
      end.join("\n")

      message = <<~MSG
        HEARTBEAT CHECK — Mission Control task board update.

        You have #{crabby_tasks.count} active task(s) assigned to you:

        #{task_list}

        Review your backlog and pick up any tasks you can action now.
        To update a task status, call: PATCH http://localhost:3000/api/v1/tasks/:id/move with { column: "in_progress" }
        To view the full board: GET http://localhost:3000/api/v1/board
      MSG

      begin
        client = ::Openclaw::GatewayClient.new
        client.post("/api/message", {
          agent_id:   "main",
          content:    message,
          session_id: "heartbeat-tasks"
        })
      rescue ::Openclaw::GatewayError, Faraday::Error => e
        Rails.logger.warn("[HeartbeatCheckJob] Could not notify OpenClaw: #{e.message}")
      end

      ::EventStore.emit(
        type:    "heartbeat",
        message: "Heartbeat: #{crabby_tasks.count} task(s) in Crabby's queue",
        metadata: { task_count: crabby_tasks.count }
      )
    end
  end
end
