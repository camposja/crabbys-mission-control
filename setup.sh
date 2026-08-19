#!/usr/bin/env bash
set -e

# ============================================================
# Crabby's Mission Control — Local Setup Script
# ============================================================

RAILS_PORT="${RAILS_PORT:-3002}"
REACT_PORT="${REACT_PORT:-5173}"
OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"

echo ""
echo "🦀  Crabby's Mission Control — Setup"
echo "=================================================="

# ── 1. Detect OpenClaw ──────────────────────────────────────
if [ -d "$OPENCLAW_HOME" ]; then
  echo "✅  OpenClaw found at: $OPENCLAW_HOME"
else
  echo "⚠️   OpenClaw not found at $OPENCLAW_HOME"
  echo "    Set OPENCLAW_HOME to override."
fi

# ── 2. Check mise (required for correct Ruby/Node versions) ─
if ! command -v mise &>/dev/null; then
  echo "❌  mise not found."
  echo "    Install it: https://mise.jdx.dev"
  echo "    Then run: mise install"
  exit 1
fi
echo "✅  mise: $(mise --version)"

# ── 3. Install language runtimes via mise ───────────────────
echo ""
echo "⚙️   Installing Ruby/Node via mise (from .tool-versions)…"
mise install

echo "✅  Ruby: $(mise exec -- ruby --version)"
echo "✅  Node: $(mise exec -- node --version)"

# ── 4. Backend setup ────────────────────────────────────────
echo ""
echo "📦  Installing Ruby gems…"
cd backend

# Sanity check — .env.example must exist in a valid clone
if [ ! -f ".env.example" ]; then
  echo "❌  backend/.env.example is missing."
  echo "    This file should be tracked in git. Please re-clone the repo."
  exit 1
fi

# Generate .env from .env.example on first run
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo ""
  echo "📝  Created backend/.env from .env.example"
  echo ""
  echo "    ┌─────────────────────────────────────────────────────┐"
  echo "    │  ACTION REQUIRED before using OpenClaw features:    │"
  echo "    │                                                     │"
  echo "    │  Edit backend/.env and set:                         │"
  echo "    │    OPENCLAW_GATEWAY_TOKEN=<your token>              │"
  echo "    │                                                     │"
  echo "    │  Find your token in ~/.openclaw/config.yml          │"
  echo "    └─────────────────────────────────────────────────────┘"
  echo ""
else
  echo "✅  backend/.env already exists — skipping copy"
fi

mise exec -- bundle install --quiet

echo "🗄️   Setting up database…"
mise exec -- bundle exec rails db:create 2>/dev/null || true
mise exec -- bundle exec rails db:migrate

cd ..

# ── 5. Frontend setup ───────────────────────────────────────
echo ""
echo "📦  Installing Node dependencies…"
cd frontend

# Always the Corepack-pinned pnpm from frontend/package.json ("packageManager"),
# never whatever happens to be on PATH. NEVER npm/yarn here — that would bypass
# the supply-chain policy in pnpm-workspace.yaml and write a stray lockfile.
mise exec -- corepack pnpm install --silent

if [ ! -f ".env.local" ]; then
  printf "VITE_API_URL=http://localhost:%s/api/v1\nVITE_CABLE_URL=ws://localhost:%s/cable\n" \
    "$RAILS_PORT" "$RAILS_PORT" > .env.local
  echo "✅  Created frontend/.env.local"
else
  echo "✅  frontend/.env.local already exists — skipping"
fi

cd ..

# ── 6. Done ─────────────────────────────────────────────────
echo ""
echo "✅  Setup complete!"
echo ""
echo "To start the app, run TWO terminals (both bound to loopback only):"
echo ""
echo "  Terminal 1 (Rails API on 127.0.0.1:$RAILS_PORT):"
echo "    cd backend && RAILS_BIND=127.0.0.1 mise exec -- bundle exec rails server -b 127.0.0.1 -p $RAILS_PORT"
echo ""
echo "  Terminal 2 (React frontend on 127.0.0.1:$REACT_PORT):"
echo "    cd frontend && VITE_BIND=127.0.0.1 mise exec -- corepack pnpm dev --host 127.0.0.1 --port $REACT_PORT"
echo ""
echo "  Then open: http://localhost:$REACT_PORT"
echo ""
echo "  Both servers refuse a non-loopback bind unless you deliberately opt in"
echo "  (MISSION_CONTROL_ALLOW_LAN=true / VITE_ENABLE_LAN_MODE=true). LAN mode gives"
echo "  everyone on the network the Terminal page, which runs shell commands as you."
echo ""
# Remind if token is still a placeholder
if grep -q "your_token_here" backend/.env 2>/dev/null; then
  echo "⚠️   REMINDER: Edit backend/.env — OPENCLAW_GATEWAY_TOKEN is still a placeholder."
  echo ""
fi
