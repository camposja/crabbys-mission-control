# In-memory ring buffer for recent events (survives page reloads, not server restarts).
# Keeps the last 200 events in a thread-safe array.
# For persistence across restarts, this could be backed by Redis — fine for local use as-is.
module EventStore
  MAX_EVENTS = 200

  @store = []
  @mutex  = Mutex.new

  def self.push(event)
    @mutex.synchronize do
      @store.unshift(event)
      @store.pop if @store.size > MAX_EVENTS
    end
    # Broadcast to all dashboard subscribers
    ActionCable.server.broadcast("events:all", event)
    # Also broadcast to per-agent channel if agent_id is set
    if event[:agent_id].present?
      ActionCable.server.broadcast("events:agent:#{event[:agent_id]}", event)
    end
  end

  def self.recent(count = 50)
    @mutex.synchronize { @store.first(count) }
  end

  def self.clear
    @mutex.synchronize { @store.clear }
  end

  # Convenience builder — call this from anywhere to emit an event
  def self.emit(type:, message:, agent_id: nil, metadata: {})
    push({
      id:        SecureRandom.uuid,
      type:      type,
      message:   message,
      agent_id:  agent_id,
      metadata:  metadata,
      timestamp: Time.current.iso8601
    })
  end
end
