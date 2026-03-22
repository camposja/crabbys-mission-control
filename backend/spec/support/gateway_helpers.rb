# Shared helpers to stub the OpenClaw gateway in tests.
#
# The gateway now uses WebSocket JSON-RPC. We stub at the GatewayClient level
# rather than HTTP, since WebMock can't intercept WebSocket connections.
# The HTTP /health endpoint is still stubbed with WebMock for the health method.
module GatewayHelpers
  GATEWAY_URL = "http://localhost:18789"

  def stub_gateway_health(status: "ok")
    # The health method still uses HTTP GET /health
    stub_request(:get, "#{GATEWAY_URL}/health")
      .to_return(status: 200, body: { status: status }.to_json,
                 headers: { "Content-Type" => "application/json" })
  end

  def stub_gateway_rpc(method:, result: {})
    allow_any_instance_of(Openclaw::GatewayClient).to receive(:rpc)
      .with(method, anything).and_return(result)
  end

  def stub_gateway_agents(agents: [])
    allow_any_instance_of(Openclaw::GatewayClient).to receive(:rpc)
      .with("agents.list", anything).and_return({ "agents" => agents })
    # Also stub the no-args variant
    allow_any_instance_of(Openclaw::GatewayClient).to receive(:rpc)
      .with("agents.list").and_return({ "agents" => agents })
  end

  def stub_gateway_message(response_content: "AI response")
    allow_any_instance_of(Openclaw::GatewayClient).to receive(:chat_send)
      .with(anything).and_return({ "message" => { "content" => response_content } })
    # Also stub the raw rpc call in case someone calls it directly
    allow_any_instance_of(Openclaw::GatewayClient).to receive(:rpc)
      .with("chat.send", anything).and_return({ "message" => { "content" => response_content } })
  end

  def stub_gateway_error
    stub_request(:get, "#{GATEWAY_URL}/health")
      .to_raise(Faraday::ConnectionFailed.new("Connection refused"))
    allow_any_instance_of(Openclaw::GatewayClient).to receive(:rpc)
      .and_raise(Openclaw::GatewayError.new("Connection refused"))
    allow_any_instance_of(Openclaw::GatewayClient).to receive(:health)
      .and_raise(Openclaw::GatewayError.new("Connection refused"))
  end
end

RSpec.configure do |config|
  config.include GatewayHelpers, type: :request
  config.include GatewayHelpers, type: :controller

  # Default: stub gateway health check for all request specs
  config.before(:each, type: :request) do
    stub_gateway_health
    # Stub the RPC health check too (used by integration_check and auth probes)
    allow_any_instance_of(Openclaw::GatewayClient).to receive(:rpc)
      .with("health").and_return({ "status" => "ok" })
  end
end
