module Calendar
  class ExecutionVerifier
    TERMINAL_STATUSES = %w[completed failed missed].freeze

    def initialize(event)
      @event = event
    end

    def call
      result = {
        verified: false,
        suggested_status: @event.status,
        verification_source: "unverified",
        detail: nil,
        task: nil,
        relevant_events: [],
        checked_at: Time.current
      }

      # 1. Check linked task
      verify_via_task(result) if @event.task_id.present?

      # 2. Check EventStore (complements task check)
      verify_via_event_store(result)

      # 3. Check gateway_reference
      if @event.gateway_reference.present? && !result[:verified]
        result[:verification_source] = "gateway"
        result[:detail] = "gateway verification not yet implemented"
      end

      # 4. Default / unverified fallback
      apply_fallback(result) unless result[:verified]

      # Persist verification metadata on the event
      persist_result(result)

      result
    end

    private

    def verify_via_task(result)
      task = @event.task
      return unless task

      result[:task] = {
        id: task.id,
        title: task.title,
        status: task.status,
        agent_status: task.agent_status
      }

      case task.agent_status
      when "completed"
        result[:verified] = true
        result[:suggested_status] = "completed"
        result[:verification_source] = "task_state"
        result[:detail] = "Task agent_status is completed"
      when "failed", "spawn_failed"
        result[:verified] = true
        result[:suggested_status] = "failed"
        result[:verification_source] = "task_state"
        result[:detail] = "Task agent_status is #{task.agent_status}"
      when "running", "in_progress"
        result[:verified] = true
        result[:suggested_status] = "running"
        result[:verification_source] = "task_state"
        result[:detail] = "Task agent_status is #{task.agent_status}"
      else
        # Check task.status as secondary signal
        if task.status == "done"
          result[:verified] = true
          result[:suggested_status] = "completed"
          result[:verification_source] = "task_state"
          result[:detail] = "Task status is done"
        elsif %w[backlog todo].include?(task.status) && @event.starts_at.present? && @event.starts_at < Time.current
          result[:suggested_status] = "missed"
          result[:verification_source] = "task_state"
          result[:detail] = "Task still in #{task.status} but event start time has passed"
        end
      end
    end

    def verify_via_event_store(result)
      recent = EventStore.recent(200)
      relevant = recent.select do |ev|
        meta = ev[:metadata] || {}
        meta[:task_id].to_s == @event.task_id.to_s && @event.task_id.present? ||
          meta[:calendar_event_id].to_s == @event.id.to_s ||
          (ev[:agent_id].present? && ev[:agent_id] == @event.agent_id)
      end

      # Filter to relevant event types
      relevant = relevant.select do |ev|
        %w[agent_completed agent_failed task_moved agent_started
           calendar_event_completed calendar_event_failed calendar_event_missed].include?(ev[:type])
      end

      result[:relevant_events] = relevant.first(3).map do |ev|
        { type: ev[:type], message: ev[:message], timestamp: ev[:timestamp] }
      end

      # If we don't already have a verified result from task, use EventStore
      return if result[:verified]
      return if relevant.empty?

      most_recent = relevant.first # EventStore stores newest first

      case most_recent[:type]
      when "agent_completed", "calendar_event_completed"
        result[:verified] = true
        result[:suggested_status] = "completed"
        result[:verification_source] = "event_store"
        result[:detail] = most_recent[:message]
      when "agent_failed", "calendar_event_failed"
        result[:verified] = true
        result[:suggested_status] = "failed"
        result[:verification_source] = "event_store"
        result[:detail] = most_recent[:message]
      when "agent_started"
        result[:suggested_status] = "running"
        result[:verification_source] = "event_store"
        result[:detail] = most_recent[:message]
      end
    end

    def apply_fallback(result)
      return if result[:verification_source] == "gateway"

      if @event.starts_at.present? && @event.starts_at < 1.hour.ago && @event.status == "scheduled"
        result[:suggested_status] = "missed"
        result[:verification_source] = "unverified"
        result[:detail] = "Event was scheduled for #{@event.starts_at.iso8601} but no execution evidence found"
      elsif @event.starts_at.present? && @event.starts_at > Time.current
        result[:suggested_status] = "scheduled"
        result[:verification_source] = "unverified"
        result[:detail] = "Event is scheduled for the future"
      end
    end

    def persist_result(result)
      attrs = {
        verified_at: Time.current,
        verification_source: result[:verification_source],
        execution_detail: result[:detail]
      }

      # Update status if the suggestion is definitive and event isn't already terminal
      if TERMINAL_STATUSES.include?(result[:suggested_status]) && !TERMINAL_STATUSES.include?(@event.status)
        attrs[:status] = result[:suggested_status]
      end

      @event.update_columns(attrs)
    end
  end
end
