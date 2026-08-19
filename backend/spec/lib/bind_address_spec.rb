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

  describe ".host_from_bind" do
    it "extracts hosts from Puma bind URIs" do
      expect(described_class.host_from_bind("tcp://127.0.0.1:3002")).to eq("127.0.0.1")
      expect(described_class.host_from_bind("tcp://0.0.0.0:3002")).to eq("0.0.0.0")
      expect(described_class.host_from_bind("tcp://[::1]:3002")).to eq("::1")
      expect(described_class.host_from_bind("ssl://192.168.1.5:3002?key=k&cert=c")).to eq("192.168.1.5")
    end

    it "returns nil for sockets that are not reachable over the network" do
      expect(described_class.host_from_bind("unix:///tmp/puma.sock")).to be_nil
      expect(described_class.host_from_bind("@mission-control")).to be_nil
    end
  end

  # Regression: config/puma.rb's file-level bind is discarded by Puma's Rack
  # handler (`clear_binds!`) whenever a host or port is supplied by the caller,
  # so `rails server -b 0.0.0.0`, `--binding` and BINDING=... all bypassed it.
  describe ".assert_binds_allowed!" do
    it "passes loopback binds" do
      expect(described_class.assert_binds_allowed!([ "tcp://127.0.0.1:3002" ], {})).to be_truthy
      expect(described_class.assert_binds_allowed!([ "tcp://[::1]:3002" ], {})).to be_truthy
      expect(described_class.assert_binds_allowed!([], {})).to be_truthy
    end

    it "passes unix sockets, which are not network listeners" do
      expect(described_class.assert_binds_allowed!([ "unix:///tmp/puma.sock" ], {})).to be_truthy
    end

    it "refuses a bind that came from -b / --binding / BINDING" do
      %w[tcp://0.0.0.0:3002 tcp://[::]:3002 tcp://192.168.4.158:3002].each do |bind|
        expect { described_class.assert_binds_allowed!([ bind ], {}) }
          .to raise_error(BindAddress::LanBindNotAllowed, /Refusing to start/)
      end
    end

    it "refuses when any one of several binds is non-loopback" do
      binds = [ "tcp://127.0.0.1:3002", "tcp://0.0.0.0:3003" ]
      expect { described_class.assert_binds_allowed!(binds, {}) }
        .to raise_error(BindAddress::LanBindNotAllowed, /0\.0\.0\.0:3003/)
    end

    it "allows a LAN bind only with MISSION_CONTROL_ALLOW_LAN=true" do
      binds = [ "tcp://0.0.0.0:3002" ]
      expect { described_class.assert_binds_allowed!(binds, { "MISSION_CONTROL_ALLOW_LAN" => "1" }) }
        .to raise_error(BindAddress::LanBindNotAllowed)
      expect(described_class.assert_binds_allowed!(binds, { "MISSION_CONTROL_ALLOW_LAN" => "true" }))
        .to eq(binds)
    end
  end

  # Ties the guard to the real Puma configuration: loading config/puma.rb must
  # register the plugin that runs assert_binds_allowed! before any socket opens.
  describe "config/puma.rb integration" do
    let(:config) do
      require "puma"
      require "puma/configuration"
      Puma::Configuration.new({ config_files: [ Rails.root.join("config/puma.rb").to_s ] }) { |_| }
        .tap { |c| c.load; c.clamp }
    end

    it "binds to loopback when nothing is supplied on the command line" do
      expect(config.final_options[:binds]).to eq([ "tcp://127.0.0.1:3002" ])
    end

    it "registers the loopback_guard plugin" do
      config
      expect(Puma::Plugins.find("loopback_guard")).to be_a(Class)
    end

    it "would reject the binds Puma resolves from a `-b 0.0.0.0` override" do
      resolved = Puma::Configuration.new(
        { config_files: [ Rails.root.join("config/puma.rb").to_s ], binds: [ "tcp://0.0.0.0:3002" ] }
      ) { |_| }.tap { |c| c.load; c.clamp }.final_options[:binds]

      expect(resolved).to eq([ "tcp://0.0.0.0:3002" ]) # the file-level bind is gone
      expect { described_class.assert_binds_allowed!(resolved, {}) }
        .to raise_error(BindAddress::LanBindNotAllowed)
    end
  end

  describe ".configured" do
    it "reports the configured host without raising, so the audit page can flag it" do
      expect(described_class.configured({})).to eq("127.0.0.1")
      expect(described_class.configured({ "RAILS_BIND" => "0.0.0.0" })).to eq("0.0.0.0")
    end
  end
end
