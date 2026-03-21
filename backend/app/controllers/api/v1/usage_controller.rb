module Api
  module V1
    class UsageController < BaseController
      def index
        from = params[:from] ? Time.parse(params[:from]) : 30.days.ago
        to   = params[:to]   ? Time.parse(params[:to])   : Time.current

        records = UsageRecord.for_period(from, to)

        render json: {
          total_cost:    records.total_cost.to_f.round(4),
          total_input:   records.sum(:input_tokens),
          total_output:  records.sum(:output_tokens),
          by_model:      records.summary_by_model.map { |r|
            { model: r.model_id, input: r.total_input.to_i, output: r.total_output.to_i, cost: r.total_cost.to_f.round(4) }
          },
          by_agent:      records.group(:agent_id).sum(:cost_usd).transform_values { |v| v.to_f.round(4) },
          records:       records.order(recorded_at: :desc).limit(200)
        }
      end
    end
  end
end
