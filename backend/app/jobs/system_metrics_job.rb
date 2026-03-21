# Gathers local system metrics (CPU, memory, disk) and broadcasts them
# to the "system_metrics" channel. Called every 30s via recurring jobs.
class SystemMetricsJob < ApplicationJob
  queue_as :default

  def perform
    metrics = {
      id:        SecureRandom.uuid,
      type:      "system_metrics",
      timestamp: Time.current.iso8601,
      cpu:       cpu_usage,
      memory:    memory_usage,
      disk:      disk_usage,
      rails:     "ok"
    }

    ActionCable.server.broadcast("system_metrics", metrics)

    # Also surface as an event so the feed can optionally show it
    EventStore.emit(
      type:    "metrics",
      message: "System: CPU #{metrics[:cpu]}% | RAM #{metrics[:memory][:used_mb]}MB used",
      metadata: metrics
    )
  end

  private

  def cpu_usage
    # macOS / Linux compatible one-liner
    output = `top -l 1 -s 0 | grep "CPU usage" 2>/dev/null || cat /proc/loadavg 2>/dev/null`.strip
    if output.include?("CPU usage")
      output.scan(/(\d+\.\d+)%\s+user/).flatten.first&.to_f || 0.0
    else
      # Linux: use load avg as a rough proxy
      load = output.split.first.to_f
      (load * 10).round(1)
    end
  rescue
    0.0
  end

  def memory_usage
    raw = `vm_stat 2>/dev/null`.strip
    if raw.present?
      page_size   = 4096
      free_pages  = raw.match(/Pages free:\s+(\d+)/)&.[](1).to_i
      active      = raw.match(/Pages active:\s+(\d+)/)&.[](1).to_i
      wired       = raw.match(/Pages wired down:\s+(\d+)/)&.[](1).to_i
      used_mb     = ((active + wired) * page_size / 1_048_576.0).round
      free_mb     = (free_pages * page_size / 1_048_576.0).round
      total_mb    = used_mb + free_mb
      { used_mb: used_mb, free_mb: free_mb, total_mb: total_mb,
        percent: total_mb > 0 ? ((used_mb.to_f / total_mb) * 100).round : 0 }
    else
      { used_mb: 0, free_mb: 0, total_mb: 0, percent: 0 }
    end
  rescue
    { used_mb: 0, free_mb: 0, total_mb: 0, percent: 0 }
  end

  def disk_usage
    raw = `df -h / 2>/dev/null`.strip.split("\n").last
    return { used: "?", available: "?", percent: 0 } unless raw
    parts = raw.split
    { used: parts[2], available: parts[3], percent: parts[4].to_i }
  rescue
    { used: "?", available: "?", percent: 0 }
  end
end
