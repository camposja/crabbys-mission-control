require "rails_helper"

RSpec.describe "Settings API", type: :request do
  let(:headers) { { "Content-Type" => "application/json" } }

  describe "PATCH /api/v1/settings" do
    it "stores keys on the allowlist" do
      patch "/api/v1/settings",
        params: { settings: { usage_threshold_daily_cost: "7.5" } }.to_json,
        headers: headers

      expect(response).to have_http_status(:ok)
      expect(Setting.get("usage_threshold_daily_cost")).to eq("7.5")
      expect(JSON.parse(response.body)).to include("usage_threshold_daily_cost" => "7.5")
    end

    # `permit!` used to accept anything a client sent.
    it "refuses a key that is not on the allowlist and writes nothing" do
      patch "/api/v1/settings",
        params: { settings: { admin: "true", usage_threshold_daily_cost: "7.5" } }.to_json,
        headers: headers

      expect(response).to have_http_status(:unprocessable_content)
      expect(JSON.parse(response.body)["error"]).to include("admin")
      expect(Setting.count).to eq(0)
    end

    it "reports every rejected key" do
      patch "/api/v1/settings",
        params: { settings: { admin: "1", role: "root" } }.to_json,
        headers: headers

      body = JSON.parse(response.body)
      expect(body["error"]).to include("admin", "role")
      expect(body["allowed"]).to match_array(Setting::ALLOWED_KEYS)
    end
  end

  describe "GET /api/v1/settings" do
    it "returns the stored settings" do
      Setting.set("usage_threshold_monthly_cost", "42")

      get "/api/v1/settings", headers: headers

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to eq("usage_threshold_monthly_cost" => "42")
    end
  end
end
