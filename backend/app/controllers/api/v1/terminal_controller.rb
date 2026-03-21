module Api
  module V1
    # REST endpoint for terminal session metadata.
    # The actual I/O is handled by TerminalChannel over Action Cable.
    #
    # SECURITY: This controller is local-only. Never expose the Rails server
    # publicly — anyone who can reach it gets full shell access to your machine.
    class TerminalController < BaseController
      # GET /api/v1/terminal/sessions
      def sessions
        render json: {
          active:  TerminalSession.active_count,
          max:     TerminalSession::MAX_SESSIONS,
          warning: "Terminal sessions run with your local user privileges. Keep this app localhost-only."
        }
      end

      # DELETE /api/v1/terminal/sessions/:session_id
      # Force-close a session (e.g., if the frontend tab was closed without clean disconnect)
      def destroy
        session_id = params[:session_id]
        session    = TerminalSession.get(session_id)

        unless session
          return render json: { error: "Session not found" }, status: :not_found
        end

        begin
          Process.kill("SIGHUP", session[:pid])
        rescue Errno::ESRCH
          # Already gone
        end
        session[:reader].close rescue nil
        session[:writer].close rescue nil
        TerminalSession.delete(session_id)

        render json: { closed: true, session_id: session_id }
      end
    end
  end
end
