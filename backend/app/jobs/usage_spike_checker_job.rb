# Runs every 15 minutes. Checks if usage has exceeded configured thresholds
# and broadcasts a spike event so the frontend can show a notification.
class UsageSpikeCheckerJob < ApplicationJob
  queue_as :default

  def perform
    daily_threshold   = Setting.get("usage_threshold_daily_cost")&.to_f   || 5.0
    hourly_threshold  = Setting.get("usage_threshold_hourly_tokens")&.to_i || 500_000
    monthly_threshold = Setting.get("usage_threshold_monthly_cost")&.to_f  || 50.0

    # Daily cost check
    today_cost = UsageRecord.for_period(Time.current.beginning_of_day, Time.current).total_cost.to_f
    if today_cost > daily_threshold
      emit_spike("daily_cost", "Daily spend $#{today_cost.round(2)} exceeds threshold $#{daily_threshold}",
                 { today_cost: today_cost, threshold: daily_threshold })
    end

    # Hourly token check
    hourly_tokens = UsageRecord.for_period(1.hour.ago, Time.current).sum(:input_tokens) +
                    UsageRecord.for_period(1.hour.ago, Time.current).sum(:output_tokens)
    if hourly_tokens > hourly_threshold
      emit_spike("hourly_tokens", "Hourly token usage #{hourly_tokens} exceeds threshold #{hourly_threshold}",
                 { hourly_tokens: hourly_tokens, threshold: hourly_threshold })
    end

    # Monthly cost check
    monthly_cost = UsageRecord.for_period(Time.current.beginning_of_month, Time.current).total_cost.to_f
    if monthly_cost > monthly_threshold
      emit_spike("monthly_cost", "Monthly spend $#{monthly_cost.round(2)} exceeds threshold $#{monthly_threshold}",
                 { monthly_cost: monthly_cost, threshold: monthly_threshold })
    end
  end

  private

  def emit_spike(spike_type, message, metadata)
    EventStore.emit(
      type:     "usage_spike",
      message:  message,
      metadata: metadata.merge(spike_type: spike_type)
    )
  end
end
