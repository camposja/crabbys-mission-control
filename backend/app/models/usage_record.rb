class UsageRecord < ApplicationRecord
  validates :recorded_at, presence: true

  scope :by_agent, ->(id)       { where(agent_id: id) }
  scope :by_model, ->(id)       { where(model_id: id) }
  scope :for_period, ->(from, to) { where(recorded_at: from..to) }

  def self.total_cost
    sum(:cost_usd)
  end

  def self.summary_by_model
    group(:model_id)
      .select("model_id, SUM(input_tokens) as total_input, SUM(output_tokens) as total_output, SUM(cost_usd) as total_cost")
  end
end
