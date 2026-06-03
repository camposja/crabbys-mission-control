require 'rails_helper'
require Rails.root.join("lib", "cors_origins")

RSpec.describe CorsOrigins do
  def matches?(origins, value)
    origins.any? { |o| o.is_a?(Regexp) ? o.match?(value) : o == value }
  end

  describe ".call" do
    it "always allows localhost dev origins" do
      origins = described_class.call(allow_lan: false)
      expect(matches?(origins, "http://localhost:5173")).to be(true)
      expect(matches?(origins, "http://127.0.0.1:5173")).to be(true)
    end

    it "rejects LAN/Tailscale origins by default (LAN off)" do
      origins = described_class.call(allow_lan: false)
      expect(matches?(origins, "http://192.168.1.10:5173")).to be(false)
      expect(matches?(origins, "http://10.0.0.5:5173")).to be(false)
      expect(matches?(origins, "http://100.100.20.1:5173")).to be(false)
    end

    it "allows private + Tailscale origins when LAN is enabled" do
      origins = described_class.call(allow_lan: true)
      expect(matches?(origins, "http://192.168.1.10:5173")).to be(true)
      expect(matches?(origins, "http://10.0.0.5:5173")).to be(true)
      expect(matches?(origins, "http://172.16.4.2:5173")).to be(true)
      expect(matches?(origins, "http://172.31.255.9:5173")).to be(true)
      expect(matches?(origins, "http://100.100.20.1:5173")).to be(true)   # Tailscale CGNAT
      expect(matches?(origins, "https://my-host.tailnet.ts.net")).to be(true) # MagicDNS
      # still allows localhost
      expect(matches?(origins, "http://localhost:5173")).to be(true)
    end

    it "does not allow public/non-private IPs even when LAN is enabled" do
      origins = described_class.call(allow_lan: true)
      expect(matches?(origins, "http://8.8.8.8:5173")).to be(false)
      expect(matches?(origins, "http://172.15.0.1:5173")).to be(false) # just below 172.16
      expect(matches?(origins, "http://172.32.0.1:5173")).to be(false) # just above 172.31
      expect(matches?(origins, "http://192.168.1.10:3000")).to be(false) # wrong port
    end

    it "reads the env flag by default" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("MISSION_CONTROL_ALLOW_LAN").and_return("true")
      expect(matches?(described_class.call, "http://192.168.1.10:5173")).to be(true)
    end
  end
end
