# Thread-safe registry of active PTY sessions.
# Keys are session_id strings; values are { reader:, writer:, pid: } hashes.
# This is in-process state — fine for local single-server use.
module TerminalSession
  MAX_SESSIONS = 10

  @sessions = {}
  @mutex    = Mutex.new

  def self.get(session_id)
    @mutex.synchronize { @sessions[session_id] }
  end

  def self.set(session_id, handles)
    @mutex.synchronize do
      # Hard cap — prevent runaway session accumulation
      if @sessions.size >= MAX_SESSIONS && !@sessions.key?(session_id)
        Rails.logger.warn "[TerminalSession] Max sessions (#{MAX_SESSIONS}) reached, rejecting #{session_id}"
        return false
      end
      @sessions[session_id] = handles
    end
    true
  end

  def self.delete(session_id)
    @mutex.synchronize { @sessions.delete(session_id) }
  end

  def self.active_count
    @mutex.synchronize { @sessions.size }
  end

  def self.all_pids
    @mutex.synchronize { @sessions.values.map { |s| s[:pid] } }
  end
end
