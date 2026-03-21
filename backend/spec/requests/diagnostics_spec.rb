require 'rails_helper'

RSpec.describe "Diagnostics API", type: :request do
  let(:headers) { { "Content-Type" => "application/json" } }

  describe "GET /api/v1/diagnostics" do
    context "when gateway is reachable" do
      before { stub_gateway_health }

      it "returns overall status and check array" do
        get "/api/v1/diagnostics", headers: headers
        expect(response).to have_http_status(:ok)
        body = JSON.parse(response.body)
        expect(body).to have_key("overall")
        expect(body).to have_key("checks")
        expect(body["checks"]).to be_an(Array)
      end

      it "includes a gateway check that passes" do
        get "/api/v1/diagnostics", headers: headers
        body    = JSON.parse(response.body)
        gateway = body["checks"].find { |c| c["key"] == "gateway" }
        expect(gateway["severity"]).to eq("ok")
        expect(gateway["status"]).to eq("connected")
      end

      it "always includes a database check" do
        get "/api/v1/diagnostics", headers: headers
        body = JSON.parse(response.body)
        db   = body["checks"].find { |c| c["key"] == "database" }
        expect(db).not_to be_nil
        expect(db["severity"]).to eq("ok")
      end

      it "includes disk, memory, cpu, and solid_queue checks" do
        get "/api/v1/diagnostics", headers: headers
        body = JSON.parse(response.body)
        keys = body["checks"].map { |c| c["key"] }
        expect(keys).to include("disk", "memory", "cpu", "solid_queue")
      end
    end

    context "when gateway is unreachable" do
      before { stub_gateway_error }

      it "returns critical overall status" do
        get "/api/v1/diagnostics", headers: headers
        body    = JSON.parse(response.body)
        gateway = body["checks"].find { |c| c["key"] == "gateway" }
        expect(gateway["severity"]).to eq("critical")
        expect(gateway["action"]).to eq("restart_gateway")
      end
    end
  end
end
