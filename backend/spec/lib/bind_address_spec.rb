require "rails_helper"

RSpec.describe BindAddress do
  describe ".resolve" do
    it "defaults to loopback when RAILS_BIND is unset" do
      expect(described_class.resolve({})).to eq("127.0.0.1")
    end

    it "defaults to loopback when RAILS_BIND is blank" do
      expect(described_class.resolve({ "RAILS_BIND" => "  " })).to eq("127.0.0.1")
    end

    it "accepts loopback hosts without any opt-in" do
      %w[127.0.0.1 localhost ::1 [::1]].each do |host|
        expect(described_class.resolve({ "RAILS_BIND" => host })).to eq(host)
      end
    end

    it "refuses a LAN bind without MISSION_CONTROL_ALLOW_LAN" do
      %w[0.0.0.0 :: 192.168.1.20].each do |host|
        expect { described_class.resolve({ "RAILS_BIND" => host }) }
          .to raise_error(BindAddress::LanBindNotAllowed, /Refusing to start/)
      end
    end

    it "refuses a LAN bind when MISSION_CONTROL_ALLOW_LAN is not exactly \"true\"" do
      %w[1 yes TRUE false].each do |flag|
        expect {
          described_class.resolve({ "RAILS_BIND" => "0.0.0.0", "MISSION_CONTROL_ALLOW_LAN" => flag })
        }.to raise_error(BindAddress::LanBindNotAllowed)
      end
    end

    it "allows a LAN bind only when both opt-ins are explicit" do
      env = { "RAILS_BIND" => "0.0.0.0", "MISSION_CONTROL_ALLOW_LAN" => "true" }
      expect(described_class.resolve(env)).to eq("0.0.0.0")
    end

    it "does not enable LAN mode from MISSION_CONTROL_ALLOW_LAN alone" do
      expect(described_class.resolve({ "MISSION_CONTROL_ALLOW_LAN" => "true" })).to eq("127.0.0.1")
    end
  end

  describe ".loopback?" do
    it "recognises loopback hosts" do
      expect(described_class).to be_loopback("127.0.0.1")
      expect(described_class).to be_loopback("LOCALHOST")
      expect(described_class).to be_loopback("[::1]")
    end

    it "rejects wildcard and LAN hosts" do
      expect(described_class).not_to be_loopback("0.0.0.0")
      expect(described_class).not_to be_loopback("::")
      expect(described_class).not_to be_loopback("192.168.1.20")
      expect(described_class).not_to be_loopback("")
    end
  end

  describe ".configured" do
    it "reports the configured host without raising, so the audit page can flag it" do
      expect(described_class.configured({})).to eq("127.0.0.1")
      expect(described_class.configured({ "RAILS_BIND" => "0.0.0.0" })).to eq("0.0.0.0")
    end
  end
end
