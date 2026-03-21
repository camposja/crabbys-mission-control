#!/usr/bin/env bash
set -e

# ============================================================
# Crabby's Mission Control — Local Setup Script
# ============================================================

RAILS_PORT="${RAILS_PORT:-3000}"
REACT_PORT="${REACT_PORT:-5173}"
OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
OPENCLAW_BIN="${OPENCLAW_BIN:-$(which openclaw 2>/dev/null || echo "")}"

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

# ── 2. Check Ruby ───────────────────────────────────────────
if command -v ruby &>/dev/null; then
  RUBY_VER=$(ruby --version)
  echo "✅  Ruby: $RUBY_VER"
else
  echo "❌  Ruby not found. Install via mise: mise install ruby@3.3"
  exit 1
fi

# ── 3. Check Node ───────────────────────────────────────────
if command -v node &>/dev/null; then
  NODE_VER=$(node --version)
  echo "✅  Node: $NODE_VER"
else
  echo "❌  Node not found. Install via mise: mise install node"
  exit 1
fi

# ── 4. Backend setup ────────────────────────────────────────
echo ""
echo "📦  Installing Ruby gems…"
cd backend
bundle install --quiet

echo "🗄️   Running database migrations…"
bundle exec rails db:create db:migrate 2>/dev/null || bundle exec rails db:migrate

# Write .env if it doesn't exist
if [ ! -f ".env" ]; then
  cp .env.local .env
  echo "📝  Created backend/.env — add your OPENCLAW_GATEWAY_TOKEN"
fi

cd ..

# ── 5. Frontend setup ───────────────────────────────────────
echo ""
echo "📦  Installing Node dependencies…"
cd frontend
npm install --silent

if [ ! -f ".env.local" ]; then
  echo "VITE_API_URL=http://localhost:${RAILS_PORT}/api/v1"  > .env.local
  echo "VITE_CABLE_URL=ws://localhost:${RAILS_PORT}/cable" >> .env.local
fi

cd ..

# ── 6. Done ─────────────────────────────────────────────────
echo ""
echo "✅  Setup complete!"
echo ""
echo "To start the app, run TWO terminals:"
echo ""
echo "  Terminal 1 (Rails API on port $RAILS_PORT):"
echo "    cd backend && bundle exec rails server -p $RAILS_PORT"
echo ""
echo "  Terminal 2 (React frontend on port $REACT_PORT):"
echo "    cd frontend && npm run dev"
echo ""
echo "  Then open: http://localhost:$REACT_PORT"
echo ""
echo "⚠️  Before testing OpenClaw features:"
echo "    Edit backend/.env and set OPENCLAW_GATEWAY_TOKEN"
echo ""
