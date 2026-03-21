module Api
  module V1
    class UsageController < BaseController
      # GET /api/v1/usage?from=&to=
      def index
        from, to = period_range
        records  = UsageRecord.for_period(from, to)

        render json: {
          period:       { from: from.iso8601, to: to.iso8601 },
          total_cost:   records.total_cost.to_f.round(4),
          total_input:  records.sum(:input_tokens),
          total_output: records.sum(:output_tokens),
          by_model:     records.summary_by_model.map { |r|
            { model: r.model_id, input: r.total_input.to_i, output: r.total_output.to_i, cost: r.total_cost.to_f.round(4) }
          },
          by_agent:     records.group(:agent_id).sum(:cost_usd).transform_values { |v| v.to_f.round(4) },
          records:      records.order(recorded_at: :desc).limit(200)
        }
      end

      # GET /api/v1/usage/timeline?from=&to=&bucket=day
      # Returns daily (or hourly) rollup suitable for line charts
      def timeline
        from, to = period_range
        records  = UsageRecord.for_period(from, to)

        # Group by day
        daily = records
          .group("DATE(recorded_at)")
          .select("DATE(recorded_at) AS day, SUM(input_tokens) AS total_input, SUM(output_tokens) AS total_output, SUM(cost_usd) AS total_cost")
          .order("day ASC")
          .map do |r|
            { date: r.day.to_s, input: r.total_input.to_i, output: r.total_output.to_i, cost: r.total_cost.to_f.round(4) }
          end

        # Fill in missing days with zeros so chart looks continuous
        filled = fill_date_gaps(daily, from.to_date, to.to_date)

        render json: { timeline: filled, from: from.iso8601, to: to.iso8601 }
      end

      # GET /api/v1/usage/thresholds
      def thresholds
        render json: current_thresholds
      end

      # PATCH /api/v1/usage/thresholds
      def update_thresholds
        t = params.permit(:daily_cost_usd, :hourly_tokens, :monthly_cost_usd)
        Setting.set("usage_threshold_daily_cost",   t[:daily_cost_usd])   if t[:daily_cost_usd].present?
        Setting.set("usage_threshold_hourly_tokens", t[:hourly_tokens])    if t[:hourly_tokens].present?
        Setting.set("usage_threshold_monthly_cost",  t[:monthly_cost_usd]) if t[:monthly_cost_usd].present?
        render json: current_thresholds
      end

      # POST /api/v1/usage/ingest
      # Accepts a usage record pushed from OpenClaw (agent, model, tokens, cost)
      def ingest
        record = UsageRecord.create!(
          agent_id:     params[:agent_id],
          model_id:     params[:model_id],
          input_tokens: params[:input_tokens].to_i,
          output_tokens:params[:output_tokens].to_i,
          cost_usd:     params[:cost_usd].to_f,
          recorded_at:  params[:recorded_at] ? Time.parse(params[:recorded_at]) : Time.current,
          metadata:     params[:metadata] || {}
        )

        # Check thresholds and emit spike event if exceeded
        check_thresholds!(record)

        render json: record, status: :created
      rescue => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      private

      def period_range
        from = params[:from] ? Time.parse(params[:from]) : 30.days.ago
        to   = params[:to]   ? Time.parse(params[:to])   : Time.current
        [from, to]
      end

      def current_thresholds
        {
          daily_cost_usd:  Setting.get("usage_threshold_daily_cost")&.to_f   || 5.0,
          hourly_tokens:   Setting.get("usage_threshold_hourly_tokens")&.to_i || 500_000,
          monthly_cost_usd:Setting.get("usage_threshold_monthly_cost")&.to_f  || 50.0
        }
      end

      def check_thresholds!(record)
        thresholds = current_thresholds
        today_cost = UsageRecord.for_period(Time.current.beginning_of_day, Time.current).total_cost.to_f

        if today_cost > thresholds[:daily_cost_usd]
          EventStore.emit(
            type:     "usage_spike",
            message:  "Daily cost threshold exceeded: $#{today_cost.round(2)} / $#{thresholds[:daily_cost_usd]}",
            agent_id: record.agent_id,
            metadata: { today_cost: today_cost, threshold: thresholds[:daily_cost_usd] }
          )
        end
      end

      def fill_date_gaps(daily, from_date, to_date)
        by_date = daily.index_by { |d| d[:date] }
        (from_date..to_date).map do |d|
          by_date[d.to_s] || { date: d.to_s, input: 0, output: 0, cost: 0.0 }
        end
      end
    end
  end
end
