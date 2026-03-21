module Api
  module V1
    # GET  /api/v1/diagnostics         — full system health report
    # POST /api/v1/diagnostics/restart_gateway — attempt to restart the OpenClaw gateway
    class DiagnosticsController < BaseController
      def index
        checks = [
          check_gateway,
          check_database,
          check_disk,
          check_memory,
          check_cpu,
          check_solid_queue,
        ]

        overall = checks.map { |c| c[:severity] }.include?("critical") ? "critical" :
                  checks.map { |c| c[:severity] }.include?("warning")  ? "warning"  : "ok"

        # Broadcast to system_metrics channel so dashboard reacts live
        ActionCable.server.broadcast("system_metrics", {
          event:       "diagnostics",
          overall:     overall,
          checks:      checks,
          checked_at:  Time.current.iso8601
        })

        render json: {
          overall:    overall,
          checks:     checks,
          checked_at: Time.current.iso8601
        }
      end

      # POST /api/v1/diagnostics/restart_gateway
      def restart_gateway
        # Attempt a graceful signal to the gateway process
        pid_file = File.expand_path("~/.openclaw/gateway.pid")
        if File.exist?(pid_file)
          pid = File.read(pid_file).strip.to_i
          Process.kill("HUP", pid) if pid > 0
          EventStore.emit(type: "gateway_restart", message: "Gateway restart signal sent (PID #{pid})")
          render json: { status: "signal_sent", pid: pid }
        else
          # Fallback: just verify connectivity
          gateway.get("/health")
          EventStore.emit(type: "gateway_restart", message: "Gateway restart requested — gateway is responding")
          render json: { status: "gateway_ok", note: "No PID file found; gateway appears healthy" }
        end
      rescue => e
        render json: { status: "failed", error: e.message }, status: :ok
      end

      private

      def check_gateway
        start   = Process.clock_gettime(Process::CLOCK_MONOTONIC)
        data    = gateway.get("/health")
        latency = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start) * 1000).round

        sev = latency > 2000 ? "warning" : "ok"
        {
          name:       "OpenClaw Gateway",
          key:        "gateway",
          severity:   sev,
          status:     "connected",
          value:      "#{latency}ms",
          detail:     "Latency #{latency}ms",
          suggestion: sev == "warning" ? "Gateway response is slow — check system load" : nil,
          action:     sev == "warning" ? "restart_gateway" : nil
        }
      rescue => e
        {
          name:       "OpenClaw Gateway",
          key:        "gateway",
          severity:   "critical",
          status:     "unreachable",
          value:      "error",
          detail:     e.message,
          suggestion: "Gateway is not responding. Ensure it is running on port 18789.",
          action:     "restart_gateway"
        }
      end

      def check_database
        ActiveRecord::Base.connection.execute("SELECT 1")
        count = Task.count rescue nil
        { name: "Database", key: "database", severity: "ok", status: "connected",
          value: "ok", detail: "PostgreSQL connected#{count ? " — #{count} tasks" : ""}", suggestion: nil }
      rescue => e
        { name: "Database", key: "database", severity: "critical", status: "error",
          value: "error", detail: e.message,
          suggestion: "Check that PostgreSQL is running: brew services start postgresql@17" }
      end

      def check_disk
        raw = `df -k / 2>/dev/null`.strip.split("\n").last
        return { name: "Disk", key: "disk", severity: "ok", status: "ok", value: "?", detail: "Could not read disk stats", suggestion: nil } unless raw

        parts      = raw.split
        used_kb    = parts[2].to_i
        avail_kb   = parts[3].to_i
        total_kb   = used_kb + avail_kb
        pct        = total_kb > 0 ? (used_kb.to_f / total_kb * 100).round : 0
        avail_gb   = (avail_kb / 1_048_576.0).round(1)

        sev = pct >= 90 ? "critical" : pct >= 75 ? "warning" : "ok"
        {
          name:       "Disk Space",
          key:        "disk",
          severity:   sev,
          status:     sev == "ok" ? "ok" : "at_risk",
          value:      "#{pct}%",
          detail:     "#{pct}% used — #{avail_gb}GB available",
          percent:    pct,
          suggestion: sev == "critical" ? "Disk almost full. Free up space immediately." :
                      sev == "warning"  ? "Disk is getting full. Consider archiving old agent logs." : nil
        }
      rescue
        { name: "Disk Space", key: "disk", severity: "ok", status: "unknown", value: "?", detail: "Could not read", suggestion: nil }
      end

      def check_memory
        raw = `vm_stat 2>/dev/null`.strip
        return { name: "Memory", key: "memory", severity: "ok", status: "ok", value: "?", detail: "vm_stat not available", suggestion: nil } if raw.blank?

        page_size  = 4096
        free       = raw.match(/Pages free:\s+(\d+)/)&.[](1).to_i
        active     = raw.match(/Pages active:\s+(\d+)/)&.[](1).to_i
        wired      = raw.match(/Pages wired down:\s+(\d+)/)&.[](1).to_i
        used_mb    = ((active + wired) * page_size / 1_048_576.0).round
        free_mb    = (free * page_size / 1_048_576.0).round
        total_mb   = used_mb + free_mb
        pct        = total_mb > 0 ? (used_mb.to_f / total_mb * 100).round : 0

        sev = pct >= 90 ? "critical" : pct >= 75 ? "warning" : "ok"
        {
          name:       "Memory",
          key:        "memory",
          severity:   sev,
          status:     sev == "ok" ? "ok" : "pressure",
          value:      "#{pct}%",
          detail:     "#{used_mb}MB used of #{total_mb}MB (#{pct}%)",
          percent:    pct,
          used_mb:    used_mb,
          total_mb:   total_mb,
          suggestion: sev == "critical" ? "Memory critically low. Consider stopping idle agents." :
                      sev == "warning"  ? "Memory pressure detected. Monitor active agents." : nil
        }
      rescue
        { name: "Memory", key: "memory", severity: "ok", status: "unknown", value: "?", detail: "Could not read", suggestion: nil }
      end

      def check_cpu
        raw = `top -l 1 -s 0 | grep "CPU usage" 2>/dev/null`.strip
        if raw.present?
          user_pct  = raw.scan(/(\d+\.\d+)%\s+user/).flatten.first&.to_f || 0.0
          sys_pct   = raw.scan(/(\d+\.\d+)%\s+sys/).flatten.first&.to_f  || 0.0
          total_pct = (user_pct + sys_pct).round(1)
        else
          load_raw  = `cat /proc/loadavg 2>/dev/null`.strip
          total_pct = load_raw.split.first.to_f * 10
        end

        sev = total_pct >= 90 ? "critical" : total_pct >= 70 ? "warning" : "ok"
        {
          name:       "CPU",
          key:        "cpu",
          severity:   sev,
          status:     sev == "ok" ? "ok" : "high",
          value:      "#{total_pct}%",
          percent:    total_pct,
          detail:     "#{total_pct}% utilisation",
          suggestion: sev == "critical" ? "CPU is maxed out. Check for runaway agent processes." :
                      sev == "warning"  ? "CPU load is high. Consider pausing background agents." : nil
        }
      rescue
        { name: "CPU", key: "cpu", severity: "ok", status: "unknown", value: "?", detail: "Could not read", suggestion: nil }
      end

      def check_solid_queue
        # Check if any recurring jobs have not run recently (stale > 2x their interval)
        # We do a lightweight check — just verify the jobs table is accessible
        pending_count = begin
          SolidQueue::Job.where(finished_at: nil).where("scheduled_at < ?", 10.minutes.ago).count rescue 0
        end

        sev = pending_count > 10 ? "warning" : "ok"
        {
          name:       "Background Jobs",
          key:        "solid_queue",
          severity:   sev,
          status:     sev == "ok" ? "ok" : "backlogged",
          value:      "#{pending_count} stale",
          detail:     "#{pending_count} jobs scheduled but not yet run",
          suggestion: sev == "warning" ? "Solid Queue may have stopped. Check: bin/jobs start" : nil
        }
      rescue => e
        { name: "Background Jobs", key: "solid_queue", severity: "ok", status: "unknown",
          value: "?", detail: "Cannot query job queue: #{e.message}", suggestion: nil }
      end
    end
  end
end
