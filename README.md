# 🦀 Crabby's Mission Control

A self-hosted Mission Control dashboard for [OpenClaw](https://openclaw.ai) — because every Krusty Krab needs a command center.

Built with **Ruby on Rails 8** (API) + **React 18 / Vite** (frontend) + **PostgreSQL**.

---

## What it does

- **Kanban board** — Tasks move through Backlog → In Progress → Review → Done, synced live via Action Cable
- **Agent dashboard** — See all OpenClaw agents, their status and model
- **Live event feed** — Every agent action streams to the dashboard in real time
- **Mission statement** — Set your "North Star" at the top of the dashboard; burns into agent memory
- **Usage & cost tracking** — Token usage and spend per model and agent
- **Calendar** — Cron jobs and scheduled events
- **Memory viewer** — Browse and edit agent long-term and daily memory
- **Projects** — Group tasks, memories and documents under goals

---

## Quick start

```bash
git clone https://github.com/camposja/crabbys-mission-control.git
cd crabbys-mission-control
./setup.sh
```

Then in two terminals — both bind explicitly to loopback:

```bash
# Terminal 1 — Rails API on 127.0.0.1:3002
cd backend && RAILS_BIND=127.0.0.1 mise exec -- bundle exec rails server -b 127.0.0.1 -p 3002

# Terminal 2 — Vite UI on 127.0.0.1:5173
cd frontend && VITE_BIND=127.0.0.1 corepack pnpm dev --host 127.0.0.1
```

Open **http://localhost:5173**

Or run both at once with `Procfile.dev`, which passes the same explicit loopback
binds and port 3002. Foreman is not bundled with the app — install it once
(`gem install foreman`), then:

```bash
foreman start -f Procfile.dev
```

> **Package manager:** the frontend uses **pnpm**, pinned by `packageManager` in
> `frontend/package.json` and always launched through Corepack. Use
> `corepack pnpm …` interactively and `mise exec -- corepack pnpm …` in scripts,
> Procfiles and CI — a bare `pnpm` is not on PATH here, and `npm`/`yarn` would
> bypass the supply-chain policy in `frontend/pnpm-workspace.yaml` and write a
> stray `package-lock.json`.

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `OPENCLAW_GATEWAY_URL` | `http://localhost:18789` | OpenClaw gateway URL |
| `OPENCLAW_GATEWAY_TOKEN` | — | **Required** — token from `~/.openclaw/openclaw.json` |
| `RAILS_PORT` | `3002` | Rails server port |
| `RAILS_BIND` | `127.0.0.1` | Interface Rails binds to. A non-loopback value is **refused at boot** unless `MISSION_CONTROL_ALLOW_LAN=true` |
| `DATABASE_URL` | *(from database.yml)* | Override Postgres connection |
| `MISSION_CONTROL_ALLOW_LAN` | `false` | Opt into LAN mode — allow CORS from private/Tailscale frontend origins (see below) |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3002/api/v1` | Rails API base URL (explicit override) |
| `VITE_CABLE_URL` | `ws://localhost:3002/cable` | Action Cable WebSocket URL (explicit override) |
| `VITE_BIND` | `127.0.0.1` | Interface the Vite dev/preview server binds to. A non-loopback value is **refused at startup** unless `VITE_ENABLE_LAN_MODE=true` |
| `VITE_ENABLE_LAN_MODE` | `false` | Opt into LAN mode — derive the backend URL from the page host (see below) |

---

## Local (default) vs LAN mode

Mission Control is a no-login local operator app, so it is **localhost-only by default**:

- Rails binds to `127.0.0.1` (`RAILS_BIND`, enforced in `backend/lib/bind_address.rb`).
- Vite binds to `127.0.0.1` (`VITE_BIND`, enforced in `frontend/src/lib/devServer.js`) —
  explicitly, not by relying on Vite's implicit default.
- The frontend always talks to `http://localhost:3002`, even if you open it from a LAN URL —
  nothing silently targets the LAN.
- Rails CORS allows only `localhost` frontend origins.

Asking either server for a non-loopback interface is a hard error at startup, not a warning —
accidental exposure is the failure mode this app is designed against. Each server needs **two
keys that agree**: the interface named in `RAILS_BIND`/`VITE_BIND` **and** the matching LAN flag,
**and** that declared interface must be the one actually being bound. So the flag on its own does
not let `rails server -b 0.0.0.0` or `vite --host 0.0.0.0` through, a declared bind on its own
does not either, `RAILS_BIND=0.0.0.0` does not authorise a bind on a LAN address, and a bare
`vite --host` (every interface, naming none) is always refused.

**LAN mode (opt-in).** To reach Mission Control from another device on a trusted network
(home LAN, Tailscale, or an SSH tunnel), set **all four** values and restart **both** servers:

```bash
# backend/.env
RAILS_BIND=0.0.0.0                 # must equal the interface actually bound (`-b`, BINDING, …)
MISSION_CONTROL_ALLOW_LAN=true     # CORS allows 192.168.* / 10.* / 172.16-31.* / Tailscale 100.64.0.0/10 (100.64–100.127.x.x) / *.ts.net on :5173

# frontend/.env.local
VITE_BIND=0.0.0.0                  # must equal the host actually served (`--host`)
VITE_ENABLE_LAN_MODE=true          # frontend derives the backend URL from the page host
```

When LAN mode is active a **red warning banner** is shown and the Terminal page escalates its
notice. Notes:

- `VITE_*` vars are baked in at **build** time — the dev server picks up changes on restart,
  but a production build must be **rebuilt**.
- Use only on trusted networks. **CORS is not an auth boundary** — it only restricts browsers,
  and LAN exposure hands everyone on the network the **Terminal page, which runs shell commands
  as your macOS user**. Protecting state-changing endpoints from direct (non-browser) callers is
  a separate concern (the OpenClaw webhook already requires a token or loopback; a follow-up will
  do the same for the Terminal/exec endpoints).

---

## Finding your OPENCLAW_GATEWAY_TOKEN

```bash
# The token is stored as an env var. Check your shell profile or:
echo $OPENCLAW_GATEWAY_TOKEN

# Or look in the openclaw credentials directory:
ls ~/.openclaw/credentials/
```

---

## Architecture

```
crabbys-mission-control/
├── backend/                  # Rails 8 API
│   ├── app/
│   │   ├── channels/         # Action Cable (AgentEvents, TaskUpdates, SystemMetrics, CalendarReminders)
│   │   ├── controllers/api/v1/  # REST endpoints
│   │   ├── models/           # Task, Project, CalendarEvent, CronJob, Memory, Document, UsageRecord…
│   │   └── services/openclaw/  # GatewayClient — thin wrapper around OpenClaw HTTP gateway
│   └── db/migrate/           # All migrations
└── frontend/                 # React 18 + Vite
    └── src/
        ├── api/              # Axios API clients
        ├── components/
        │   ├── layout/       # AppLayout, Sidebar (with ErrorBoundary per panel)
        │   └── ui/           # ErrorBoundary, shared components
        ├── hooks/            # useChannel (Action Cable), others
        ├── lib/              # cable.js (ActionCable consumer), utils
        └── pages/            # Dashboard, Tasks, Projects, Agents, Memory, Calendar, Usage, Settings
```

---

## Deployment (optional)

The app is designed to run locally. If you want remote access:

- **Tailscale** — expose the Rails port via Tailscale for secure remote access
- **Fly.io** — `fly launch` from the `backend/` directory (update `config/deploy.yml`)

---

## Prompts used to build this

This app was built iteratively with 6 structured prompts fed to Claude Code. See the architecture brief for details.
