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
end
