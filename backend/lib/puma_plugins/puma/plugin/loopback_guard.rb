# Puma plugin: refuses to open a non-loopback listener without explicit opt-in.
#
# Registered from config/puma.rb. Puma fires plugin `start` hooks after the
# configuration is clamped but BEFORE the binder opens any socket, so this sees
# the final bind list — including `rails server -b 0.0.0.0`, `--binding`,
# BINDING=... and `puma -b`, all of which replace the bind set in config/puma.rb.
require "puma/plugin"
require_relative "../../../bind_address"

Puma::Plugin.create do
  def start(launcher)
    BindAddress.assert_binds_allowed!(launcher.options[:binds])
  end
end
