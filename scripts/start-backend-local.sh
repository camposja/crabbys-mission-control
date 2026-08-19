#!/usr/bin/env bash
set -euo pipefail

# Start Mission Control Rails API from the repo root, using the pinned mise Ruby.
# This avoids the OpenClaw env issue where `bundle exec rails server` can fail even after `bundle check` passes.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend"

if ! command -v mise >/dev/null 2>&1; then
  echo "mise is required for Ruby 3.3.10" >&2
  exit 1
fi

mise exec ruby@3.3.10 -- bundle check >/dev/null 2>&1 || mise exec ruby@3.3.10 -- bundle install
# Explicit loopback bind: the Terminal endpoints run shell commands as this user.
# A non-loopback RAILS_BIND additionally requires MISSION_CONTROL_ALLOW_LAN=true
# (enforced in backend/lib/bind_address.rb — the bind is refused, not warned about).
RAILS_BIND="${RAILS_BIND:-127.0.0.1}"
export RAILS_BIND
exec mise exec ruby@3.3.10 -- ruby -rbundler/setup bin/rails server -b "$RAILS_BIND" -p "${PORT:-3002}"
