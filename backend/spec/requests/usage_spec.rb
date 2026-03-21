require 'rails_helper'

RSpec.describe "Usage API", type: :request do
  let(:headers) { { "Content-Type" => "application/json" } }

  # ── GET /api/v1/usage ────────────────────────────────────────────────────────
  describe "GET /api/v1/usage" do
    before do
      create(:usage_record, model_id: "claude-opus-4-6",  cost_usd: 0.10, input_tokens: 1000, output_tokens: 500,  recorded_at: 5.days.ago)
      create(:usage_record, model_id: "claude-haiku-4-5", cost_usd: 0.02, input_tokens: 500,  output_tokens: 200,  recorded_at: 3.days.ago)
    end

    it "returns total cost and token counts" do
      get "/api/v1/usage", headers: headers
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["total_cost"].to_f).to be_within(0.001).of(0.12)
      expect(body["total_input"]).to eq(1500)
      expect(body["total_output"]).to eq(700)
    end

    it "includes per-model breakdown" do
      get "/api/v1/usage", headers: headers
      body = JSON.parse(response.body)
      models = body["by_model"].map { |m| m["model"] }
      expect(models).to include("claude-opus-4-6", "claude-haiku-4-5")
    end

    it "respects from/to date params" do
      old = create(:usage_record, cost_usd: 99.0, recorded_at: 60.days.ago)
      get "/api/v1/usage?from=#{30.days.ago.iso8601}", headers: headers
      body = JSON.parse(response.body)
      # old record should be excluded
      expect(body["total_cost"].to_f).to be < 1.0
    end
  end

  # ── GET /api/v1/usage/timeline ───────────────────────────────────────────────
  describe "GET /api/v1/usage/timeline" do
    before do
      create(:usage_record, input_tokens: 1000, output_tokens: 500, cost_usd: 0.05, recorded_at: 2.days.ago)
      create(:usage_record, input_tokens: 2000, output_tokens: 800, cost_usd: 0.08, recorded_at: 1.day.ago)
    end

    it "returns a timeline array with date keys" do
      get "/api/v1/usage/timeline?from=#{7.days.ago.iso8601}", headers: headers
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["timeline"]).to be_an(Array)
      expect(body["timeline"].first).to have_key("date")
      expect(body["timeline"].first).to have_key("input")
      expect(body["timeline"].first).to have_key("cost")
    end

    it "fills gaps with zero values" do
      get "/api/v1/usage/timeline?from=#{7.days.ago.iso8601}", headers: headers
      body = JSON.parse(response.body)
      # Should have 7 entries (one per day), filling empty days with zeros
      expect(body["timeline"].length).to be >= 7
      zero_entries = body["timeline"].select { |e| e["cost"].to_f == 0.0 }
      expect(zero_entries).not_to be_empty
    end
  end

  # ── GET/PATCH /api/v1/usage/thresholds ───────────────────────────────────────
  describe "GET /api/v1/usage/thresholds" do
    it "returns default thresholds" do
      get "/api/v1/usage/thresholds", headers: headers
      body = JSON.parse(response.body)
      expect(body).to have_key("daily_cost_usd")
      expect(body).to have_key("hourly_tokens")
      expect(body).to have_key("monthly_cost_usd")
    end
  end

  describe "PATCH /api/v1/usage/thresholds" do
    it "saves threshold settings" do
      patch "/api/v1/usage/thresholds",
            params:  { daily_cost_usd: 10.0, monthly_cost_usd: 100.0 }.to_json,
            headers: headers
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["daily_cost_usd"].to_f).to eq(10.0)
    end
  end

  # ── POST /api/v1/usage/ingest ─────────────────────────────────────────────────
  describe "POST /api/v1/usage/ingest" do
    let(:payload) do
      {
        agent_id:      "crabby",
        model_id:      "claude-opus-4-6",
        input_tokens:  2000,
        output_tokens: 800,
        cost_usd:      0.15,
        recorded_at:   Time.current.iso8601
      }
    end

    it "creates a usage record and returns 201" do
      expect {
        post "/api/v1/usage/ingest", params: payload.to_json, headers: headers
      }.to change(UsageRecord, :count).by(1)
      expect(response).to have_http_status(:created)
    end

    it "emits a usage_spike event when daily threshold is exceeded" do
      Setting.set("usage_threshold_daily_cost", 0.01)  # very low threshold
      expect(EventStore).to receive(:emit).with(hash_including(type: "usage_spike")).at_least(:once)
      post "/api/v1/usage/ingest", params: payload.to_json, headers: headers
    end
  end
end
