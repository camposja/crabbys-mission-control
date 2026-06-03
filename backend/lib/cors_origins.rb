# Builds the allowed CORS origin list for the frontend.
#
# Mission Control is a local-first companion app: localhost dev origins are
# ALWAYS allowed. LAN/Tailscale origins are only allowed when the operator
# explicitly opts in via MISSION_CONTROL_ALLOW_LAN=true.
#
# NOTE: CORS only restricts *browser* cross-origin requests — it is accidental-
# exposure prevention, not an auth boundary. Real protection for state-changing,
# non-browser callers lives at the endpoint level (see the OpenClaw webhook
# token-or-loopback guard, and the planned Terminal/exec follow-up).
#
# Extracted as a plain object (not an autoloaded constant) so it can be unit
# tested without booting the Rack::Cors middleware, and required explicitly from
# the initializer (initializers run before autoloading is ready).
module CorsOrigins
  # Always-allowed local dev origins.
  LOCAL = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3001"
  ].freeze

  # LAN + Tailscale origins (Vite dev server on :5173), gated behind the flag.
  LAN = [
    %r{\Ahttp://192\.168\.\d{1,3}\.\d{1,3}:5173\z},                          # 192.168.0.0/16
    %r{\Ahttp://10\.\d{1,3}\.\d{1,3}\.\d{1,3}:5173\z},                       # 10.0.0.0/8
    %r{\Ahttp://172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}:5173\z},           # 172.16.0.0/12
    %r{\Ahttp://100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}:5173\z}, # Tailscale 100.64.0.0/10
    %r{\Ahttps?://[a-z0-9-]+(\.[a-z0-9-]+)*\.ts\.net(:5173)?\z}i             # Tailscale MagicDNS
  ].freeze

  # @return [Array<String, Regexp>] origins to pass to Rack::Cors `origins(*...)`
  def self.call(allow_lan: ENV["MISSION_CONTROL_ALLOW_LAN"] == "true")
    allow_lan ? LOCAL + LAN : LOCAL.dup
  end
end
