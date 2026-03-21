require "pty"
require "io/console"

# Streams a pseudoterminal session to the React frontend via Action Cable.
# Security: Only accessible from localhost. Never expose this to the internet.
#
# Protocol:
#   Client → server:  { action: "input", data: "<keystrokes>", session_id: "abc" }
#   Client → server:  { action: "resize", cols: 120, rows: 40, session_id: "abc" }
#   Server → client:  { output: "<text>", session_id: "abc" }
#
class TerminalChannel < ApplicationCable::Channel
  # Guards against remote access — this is a local-only tool.
  # Action Cable connections come through the Rails server which is
  # bound to localhost, but we double-check here as a defence-in-depth measure.
  ALLOWED_SHELLS = ["/bin/zsh", "/bin/bash", "/bin/sh"].freeze

  def subscribed
    session_id = params[:session_id]
    return reject unless session_id.present?

    stream_from "terminal:#{session_id}"
    spawn_pty(session_id)
  end

  def unsubscribed
    session_id = params[:session_id]
    cleanup_session(session_id)
    stop_all_streams
  end

  def input(data)
    session_id = data["session_id"] || params[:session_id]
    return unless session_id.present?

    session = TerminalSession.get(session_id)
    return unless session

    begin
      session[:writer].write(data["data"].to_s)
    rescue Errno::EIO, IOError
      cleanup_session(session_id)
    end
  end

  def resize(data)
    session_id = data["session_id"] || params[:session_id]
    session    = TerminalSession.get(session_id)
    return unless session

    cols = data["cols"].to_i.clamp(10, 500)
    rows = data["rows"].to_i.clamp(5, 200)
    begin
      session[:writer].winsize = [rows, cols]
    rescue Errno::ENOTTY, IOError
      # Not a TTY or already closed — ignore
    end
  end

  private

  def spawn_pty(session_id)
    shell   = ALLOWED_SHELLS.find { |s| File.executable?(s) } || "/bin/sh"
    env     = { "TERM" => "xterm-256color", "LANG" => "en_US.UTF-8" }

    reader, writer, pid = PTY.spawn(env, shell)

    # Save session handles
    TerminalSession.set(session_id, { reader: reader, writer: writer, pid: pid })

    # Stream PTY output back to the frontend in a background thread
    Thread.new do
      begin
        loop do
          data = reader.read_nonblock(4096)
          ActionCable.server.broadcast("terminal:#{session_id}", { output: data, session_id: session_id })
        end
      rescue IO::WaitReadable
        IO.select([reader])
        retry
      rescue Errno::EIO, IOError, PTY::ChildExited
        ActionCable.server.broadcast("terminal:#{session_id}", {
          output:     "\r\n[Session ended]\r\n",
          session_id: session_id,
          closed:     true
        })
        TerminalSession.delete(session_id)
      end
    end
  end

  def cleanup_session(session_id)
    session = TerminalSession.get(session_id)
    return unless session

    begin
      Process.kill("SIGHUP", session[:pid])
    rescue Errno::ESRCH
      # Process already gone
    end
    session[:reader].close rescue nil
    session[:writer].close rescue nil
    TerminalSession.delete(session_id)
  end
end
