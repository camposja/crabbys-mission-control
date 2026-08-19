# Resolves the network interface the Rails server binds to.
#
# Mission Control is a no-login local operator app whose Terminal endpoints run
# shell commands as the macOS user. Binding to anything other than loopback
# therefore hands full command execution to every host that can reach this
# machine, so it takes TWO explicit opt-ins:
#
#   RAILS_BIND=0.0.0.0
#   MISSION_CONTROL_ALLOW_LAN=true
#
# Without both, a non-loopback RAILS_BIND is refused at boot rather than
# silently honoured. The default (no RAILS_BIND set) is 127.0.0.1.
#
# NOTE: CORS is not authentication (see lib/cors_origins.rb). Binding to a LAN
# interface exposes the API and the Terminal to non-browser callers, which CORS
# does nothing about.
#
# Plain module (not just an autoloaded constant) so config/puma.rb can require
# it directly — Puma reads its config before Rails/Zeitwerk are available.
module BindAddress
  DEFAULT = "127.0.0.1".freeze

  # Hosts that can only be reached from this machine.
  LOOPBACK = %w[127.0.0.1 ::1 localhost].freeze

  # Raised when RAILS_BIND asks for a non-loopback interface without opt-in.
  class LanBindNotAllowed < StandardError; end

  # "[::1]" -> "::1", " 127.0.0.1 " -> "127.0.0.1"
  def self.normalize(host)
    host.to_s.strip.downcase.delete_prefix("[").delete_suffix("]")
  end

  def self.loopback?(host)
    LOOPBACK.include?(normalize(host))
  end

  def self.allow_lan?(env = ENV)
    env["MISSION_CONTROL_ALLOW_LAN"] == "true"
  end

  # Two keys, and they have to agree.
  #
  # The flag alone is NOT enough: `MISSION_CONTROL_ALLOW_LAN=true` plus
  # `rails server -b 0.0.0.0` used to be accepted, which let a command-line flag
  # decide the exposure. The operator must also have declared the interface in
  # RAILS_BIND, and it must be the interface actually being bound — so a
  # RAILS_BIND of 0.0.0.0 does not authorise a bind on a LAN address, and a
  # RAILS_BIND for one address does not authorise another.
  def self.lan_bind_authorized?(host, env = ENV)
    return false unless allow_lan?(env)

    declared = env["RAILS_BIND"].to_s.strip
    return false if declared.empty?

    normalize(declared) == normalize(host)
  end

  # The host Rails/Puma should bind to.
  # @raise [LanBindNotAllowed] non-loopback RAILS_BIND without MISSION_CONTROL_ALLOW_LAN=true
  def self.resolve(env = ENV)
    host = env["RAILS_BIND"].to_s.strip
    return DEFAULT if host.empty?
    return host if loopback?(host)

    unless allow_lan?(env)
      raise LanBindNotAllowed,
        "RAILS_BIND=#{host} would expose the API and the Terminal (which runs shell " \
        "commands as your user) beyond this machine. Refusing to start. Use the default " \
        "127.0.0.1, or opt in deliberately with MISSION_CONTROL_ALLOW_LAN=true on a " \
        "trusted network only."
    end

    host
  end

  # The configured host WITHOUT raising — for the security audit page, which must
  # still render a finding when the configuration is unsafe.
  def self.configured(env = ENV)
    host = env["RAILS_BIND"].to_s.strip
    host.empty? ? DEFAULT : host
  end

  # No ActiveSupport here — config/puma.rb requires this file before Rails boots.
  def self.shown(value)
    text = value.to_s.strip
    text.empty? ? "(unset)" : text
  end

  # Host portion of a Puma bind URI: "tcp://127.0.0.1:3002" -> "127.0.0.1",
  # "ssl://[::1]:3002?key=..." -> "::1". Returns nil for unix/abstract sockets,
  # which are filesystem-local and cannot be reached over the network.
  def self.host_from_bind(bind)
    uri = bind.to_s.strip
    return nil if uri.start_with?("unix://", "@")

    authority = uri.sub(%r{\A[a-z][a-z0-9+.-]*://}i, "").split("?").first.to_s
    if (m = authority.match(/\A\[([^\]]+)\]/))   # bracketed IPv6
      m[1]
    else
      authority.split(":").first
    end
  end

  # Enforces the policy against the FINAL binds Puma resolved, after Rails' CLI
  # flags (-b/--binding), the BINDING env var and any `puma -b` have been merged
  # in. config/puma.rb alone cannot do this: the Rack handler calls
  # `clear_binds!` and replaces the file-level bind whenever a host or port is
  # supplied by the caller, so a file-level guard is bypassable by design.
  #
  # @raise [LanBindNotAllowed] any non-loopback bind without both opt-ins
  def self.assert_binds_allowed!(binds, env = ENV)
    offenders = Array(binds).reject do |bind|
      host = host_from_bind(bind)         # nil for unix/abstract sockets
      host.nil? || loopback?(host) || lan_bind_authorized?(host, env)
    end
    return binds if offenders.empty?

    raise LanBindNotAllowed,
      "Refusing to start: #{offenders.join(', ')} would expose the API and the Terminal " \
      "(which runs shell commands as your user) beyond this machine. Bind to 127.0.0.1 " \
      "instead. Serving a LAN interface takes BOTH keys, and they must agree: " \
      "RAILS_BIND=<the same host> and MISSION_CONTROL_ALLOW_LAN=true " \
      "(currently RAILS_BIND=#{shown(env['RAILS_BIND'])}, " \
      "MISSION_CONTROL_ALLOW_LAN=#{shown(env['MISSION_CONTROL_ALLOW_LAN'])})."
  end
end
