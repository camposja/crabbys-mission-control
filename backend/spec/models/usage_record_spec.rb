require 'rails_helper'

RSpec.describe UsageRecord, type: :model do
  # ── Validations ──────────────────────────────────────────────────────────────
  it { is_expected.to validate_presence_of(:recorded_at) }

  # ── Scopes ───────────────────────────────────────────────────────────────────
  describe ".for_period" do
    it "returns records within the date range" do
      old    = create(:usage_record, recorded_at: 40.days.ago)
      recent = create(:usage_record, recorded_at: 5.days.ago)

      result = UsageRecord.for_period(30.days.ago, Time.current)
      expect(result).to include(recent)
      expect(result).not_to include(old)
    end
  end

  describe ".by_agent" do
    it "filters by agent_id" do
      crabby = create(:usage_record, agent_id: "crabby")
      main   = create(:usage_record, agent_id: "main")
      expect(UsageRecord.by_agent("crabby")).to include(crabby)
      expect(UsageRecord.by_agent("crabby")).not_to include(main)
    end
  end

  # ── Aggregations ─────────────────────────────────────────────────────────────
  describe ".total_cost" do
    it "sums cost_usd across all records" do
      create(:usage_record, cost_usd: 0.10)
      create(:usage_record, cost_usd: 0.25)
      expect(UsageRecord.total_cost).to be_within(0.001).of(0.35)
    end
  end

  describe ".summary_by_model" do
    it "groups tokens and cost by model_id" do
      create(:usage_record, model_id: "claude-opus-4-6",   input_tokens: 1000, output_tokens: 500,  cost_usd: 0.10)
      create(:usage_record, model_id: "claude-opus-4-6",   input_tokens: 2000, output_tokens: 1000, cost_usd: 0.20)
      create(:usage_record, model_id: "claude-haiku-4-5",  input_tokens: 500,  output_tokens: 200,  cost_usd: 0.01)

      summary = UsageRecord.summary_by_model.index_by(&:model_id)

      opus = summary["claude-opus-4-6"]
      expect(opus.total_input.to_i).to eq(3000)
      expect(opus.total_output.to_i).to eq(1500)
      expect(opus.total_cost.to_f).to be_within(0.001).of(0.30)

      haiku = summary["claude-haiku-4-5"]
      expect(haiku.total_input.to_i).to eq(500)
    end
  end
end
