require 'rails_helper'

# Local-safe protection for POST /api/v1/openclaw/webhook.
# Authorized = matching X-Mission-Control-Token header, OR loopback caller when no token set.
RSpec.describe "OpenClaw Webhook auth", type: :request do
  let(:headers) { { "Content-Type" => "application/json" } }
  let(:path) { "/api/v1/openclaw/webhook" }

  # Force the request to look like it came from a non-loopback (LAN/external) host.
  # Stubbing the request object is deterministic and avoids RemoteIp-middleware flakiness.
  def stub_non_loopback!
    allow_any_instance_of(ActionDispatch::Request).to receive(:local?).and_return(false)
    allow_any_instance_of(ActionDispatch::Request).to receive(:remote_ip).and_return("203.0.113.10")
  end

  def post_webhook(body, hdrs = headers)
    post path, params: body.to_json, headers: hdrs
  end

  context "when MISSION_CONTROL_WEBHOOK_TOKEN is blank (loopback-only mode)" do
    before { ENV.delete("MISSION_CONTROL_WEBHOOK_TOKEN") } # test env default, but be explicit

    it "accepts a loopback request and surfaces the warning" do
      post_webhook(event_type: "message", message: "hi")
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["received"]).to be(true)
      expect(body["warning"]).to include("loopback-only")
    end

    it "rejects a non-loopback request with 403 and does NOT mutate task state" do
      stub_non_loopback!
      task = create(:task, status: "backlog")

      post_webhook(event_type: "task_update", task_id: task.id, column: "done")

      expect(response).to have_http_status(:forbidden)
      expect(task.reload.status).to eq("backlog") # unchanged
    end
  end

  context "when MISSION_CONTROL_WEBHOOK_TOKEN is set" do
    before { ENV["MISSION_CONTROL_WEBHOOK_TOKEN"] = "test-secret" }
    after  { ENV.delete("MISSION_CONTROL_WEBHOOK_TOKEN") }

    it "accepts a request with the correct header" do
      post_webhook({ event_type: "message", message: "hi" },
                   headers.merge("X-Mission-Control-Token" => "test-secret"))
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["warning"]).to be_nil
    end

    it "returns 401 with a wrong header" do
      post_webhook({ event_type: "message", message: "hi" },
                   headers.merge("X-Mission-Control-Token" => "nope"))
      expect(response).to have_http_status(:unauthorized)
    end

    it "returns 401 with a missing header" do
      post_webhook(event_type: "message", message: "hi")
      expect(response).to have_http_status(:unauthorized)
    end

    it "accepts a correct header even from a non-loopback host (token path ignores loopback)" do
      stub_non_loopback!
      post_webhook({ event_type: "message", message: "hi" },
                   headers.merge("X-Mission-Control-Token" => "test-secret"))
      expect(response).to have_http_status(:ok)
    end
  end

  context "authorized state change" do
    before { ENV.delete("MISSION_CONTROL_WEBHOOK_TOKEN") }

    it "still mutates the task on an authorized (loopback) task_update" do
      task = create(:task, status: "backlog")
      post_webhook(event_type: "task_update", task_id: task.id, column: "done")
      expect(response).to have_http_status(:ok)
      expect(task.reload.status).to eq("done")
    end
  end
end
