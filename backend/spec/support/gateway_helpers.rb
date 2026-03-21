# Shared helpers to stub the OpenClaw gateway in tests.
# All tests run with WebMock — no real HTTP goes out.
module GatewayHelpers
  GATEWAY_URL = "http://localhost:18789"

  def stub_gateway_health(status: "ok")
    stub_request(:get, "#{GATEWAY_URL}/health")
      .to_return(status: 200, body: { status: status }.to_json,
                 headers: { "Content-Type" => "application/json" })
  end

  def stub_gateway_agents(agents: [])
    stub_request(:get, "#{GATEWAY_URL}/api/agents")
      .to_return(status: 200, body: agents.to_json,
                 headers: { "Content-Type" => "application/json" })
  end

  def stub_gateway_message(response_content: "AI response")
    stub_request(:post, "#{GATEWAY_URL}/api/message")
      .to_return(status: 200,
                 body: { message: { content: response_content } }.to_json,
                 headers: { "Content-Type" => "application/json" })
  end

  def stub_gateway_error
    stub_request(:get, "#{GATEWAY_URL}/health")
      .to_raise(Faraday::ConnectionFailed.new("Connection refused"))
    stub_request(:get, "#{GATEWAY_URL}/api/agents")
      .to_raise(Faraday::ConnectionFailed.new("Connection refused"))
  end
end

RSpec.configure do |config|
  config.include GatewayHelpers, type: :request
  config.include GatewayHelpers, type: :controller

  # Default: stub gateway health check for all request specs
  config.before(:each, type: :request) do
    stub_gateway_health
  end
end
