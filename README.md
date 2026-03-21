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

Then in two terminals:

```bash
# Terminal 1
cd backend && bundle exec rails server -p 3000

# Terminal 2
cd frontend && npm run dev
```

Open **http://localhost:5173**

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `OPENCLAW_GATEWAY_URL` | `http://localhost:18789` | OpenClaw gateway URL |
| `OPENCLAW_GATEWAY_TOKEN` | — | **Required** — token from `~/.openclaw/openclaw.json` |
| `RAILS_PORT` | `3000` | Rails server port |
| `DATABASE_URL` | *(from database.yml)* | Override Postgres connection |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000/api/v1` | Rails API base URL |
| `VITE_CABLE_URL` | `ws://localhost:3000/cable` | Action Cable WebSocket URL |

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
