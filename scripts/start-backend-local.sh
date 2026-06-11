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
exec mise exec ruby@3.3.10 -- ruby -rbundler/setup bin/rails server -p "${PORT:-3000}"
