require 'rails_helper'

RSpec.describe UsageSpikeCheckerJob, type: :job do
  describe "#perform" do
    before do
      Setting.set("usage_threshold_daily_cost",   "0.01")  # very low — will trigger
      Setting.set("usage_threshold_hourly_tokens", "100")   # very low — will trigger
      Setting.set("usage_threshold_monthly_cost",  "0.01")
    end

    context "when usage exceeds all thresholds" do
      before do
        create(:usage_record, cost_usd: 1.0, input_tokens: 5000, output_tokens: 2000,
               recorded_at: 30.minutes.ago)
      end

      it "emits usage_spike events" do
        expect(EventStore).to receive(:emit)
          .with(hash_including(type: "usage_spike"))
          .at_least(:once)
        described_class.new.perform
      end
    end

    context "when usage is under all thresholds" do
      before do
        Setting.set("usage_threshold_daily_cost",   "1000")
        Setting.set("usage_threshold_hourly_tokens", "10000000")
        Setting.set("usage_threshold_monthly_cost",  "1000")
      end

      it "does not emit spike events" do
        create(:usage_record, cost_usd: 0.001, recorded_at: 30.minutes.ago)
        expect(EventStore).not_to receive(:emit).with(hash_including(type: "usage_spike"))
        described_class.new.perform
      end
    end
  end
end
