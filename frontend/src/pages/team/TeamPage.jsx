import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { agentsApi } from "../../api/agents";
import { useChannel } from "../../hooks/useChannel";
import { Users, Building2, Bot, Waves, Sparkles } from "lucide-react";
import ErrorBoundary from "../../components/ui/ErrorBoundary";

function statusColor(status) {
  switch (status) {
    case "active":  return "#4ade80";
    case "paused":  return "#facc15";
    case "idle":    return "#60a5fa";
    case "error":   return "#f87171";
    default:        return "#64748b";
  }
}

function agentInitials(agent) {
  const name = (agent.name || agent.id || "?").toLowerCase();
  if (name === "crabby") return "🦀";
  if (name === "jose" || name === "main") return "🧑🏽‍💻";
  if (name.includes("codex")) return "🐙";
  return (agent.name || agent.id || "?").slice(0, 2).toUpperCase();
}

function displayName(agent) {
  const name = (agent.name || agent.id || "Unknown").toLowerCase();
  if (name === "main") return "Jose";
  if (name.includes("codex")) return "Codex Agent";
  if (name === "crabby") return "Crabby";
  return agent.name || agent.id;
}

function deskTone(agent) {
  const name = (agent.name || agent.id || "").toLowerCase();
  if (name === "crabby") return {
    shell: "from-orange-500/30 to-orange-700/20",
    ring: "border-orange-400/40",
    glow: "shadow-orange-500/10",
  };
  if (name === "jose" || name === "main") return {
    shell: "from-sky-500/30 to-blue-700/20",
    ring: "border-sky-400/40",
    glow: "shadow-sky-500/10",
  };
  if (name.includes("codex")) return {
    shell: "from-fuchsia-500/25 to-violet-700/20",
    ring: "border-violet-400/40",
    glow: "shadow-violet-500/10",
  };
  return {
    shell: "from-slate-500/20 to-slate-700/20",
    ring: "border-slate-500/30",
    glow: "shadow-black/10",
  };
}

function OfficeBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-900/25 via-sky-950 to-slate-950" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-cyan-400/8 to-transparent" />

      <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 1200 700" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="waterGlow" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </linearGradient>
        </defs>

        <circle cx="1080" cy="90" r="30" fill="#93c5fd" opacity="0.08" />
        <circle cx="1120" cy="130" r="12" fill="#bae6fd" opacity="0.1" />
        <circle cx="1020" cy="145" r="9" fill="#e0f2fe" opacity="0.08" />
        <circle cx="150" cy="100" r="16" fill="#bae6fd" opacity="0.06" />
        <circle cx="185" cy="135" r="8" fill="#e0f2fe" opacity="0.07" />

        <path d="M0,560 C160,520 240,610 390,575 C500,550 610,500 760,550 C890,595 1010,545 1200,585 L1200,700 L0,700 Z" fill="url(#waterGlow)" />

        <g opacity="0.10" transform="translate(930 410)">
          <path d="M38 0 C55 0 70 14 70 32 L70 92 L8 92 L8 32 C8 14 21 0 38 0 Z" fill="#f59e0b" />
          <path d="M18 0 L58 0 L68 -28 L8 -28 Z" fill="#22c55e" />
          <path d="M30 -28 L44 -28 L50 -48 L24 -48 Z" fill="#16a34a" />
        </g>

        <g opacity="0.08" transform="translate(120 430)">
          <rect x="0" y="25" width="90" height="65" rx="6" fill="#f59e0b" />
          <rect x="12" y="0" width="66" height="28" rx="8" fill="#fb923c" />
          <rect x="18" y="45" width="16" height="18" fill="#111827" />
          <rect x="42" y="45" width="16" height="18" fill="#111827" />
          <rect x="66" y="45" width="16" height="18" fill="#111827" />
        </g>
      </svg>
    </div>
  );
}

function AgentDesk({ agent }) {
  const tone = deskTone(agent);
  const status = agent.status || "unknown";
  const name = displayName(agent);
  const emoji = agentInitials(agent);
  const currentTask = agent.current_task;

  return (
    <div className="relative group">
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${tone.shell} blur-xl opacity-60 group-hover:opacity-80 transition-opacity`} />
      <div className={`relative rounded-2xl border ${tone.ring} bg-slate-900/85 backdrop-blur-sm shadow-lg ${tone.glow} overflow-hidden`}>
        <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/5 to-transparent" />

        <div className="p-4 border-b border-white/5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-12 h-12 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-center text-2xl shadow-inner">
              <span role="img" aria-label={name}>{emoji}</span>
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900" style={{ backgroundColor: statusColor(status) }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{name}</p>
              <p className="text-xs text-slate-400 capitalize">{status}</p>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest">Desk</div>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-end gap-2">
                <div className="w-8 h-8 rounded-md bg-slate-800 border border-slate-700" />
                <div className="w-16 h-10 rounded-t-md bg-slate-900 border border-slate-700 border-b-slate-950 relative overflow-hidden">
                  <div className="absolute inset-1 rounded-sm bg-gradient-to-br from-cyan-400/15 via-sky-500/10 to-slate-900" />
                  <div className="absolute left-2 top-2 w-8 h-1 bg-cyan-300/20 rounded" />
                  <div className="absolute left-2 top-5 w-5 h-1 bg-sky-300/10 rounded" />
                </div>
              </div>
              <div className="w-10 h-2 rounded-full bg-slate-800/90" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2">
              <p className="text-slate-500 uppercase tracking-widest text-[10px] mb-1">Model</p>
              <p className="text-slate-200 truncate">{agent.model?.split("/").pop() || agent.model || "—"}</p>
            </div>
            <div className="rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2">
              <p className="text-slate-500 uppercase tracking-widest text-[10px] mb-1">Status</p>
              <p className="text-slate-200 capitalize truncate">{status}</p>
            </div>
          </div>

          <div className="rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2 min-h-[64px]">
            <p className="text-slate-500 uppercase tracking-widest text-[10px] mb-1">Current work</p>
            <p className="text-sm text-slate-300 leading-relaxed line-clamp-2">
              {currentTask || agent.description || "Standing by at station."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrgNode({ agent, depth = 0 }) {
  const hasChildren = agent.subagents?.length > 0;
  const name = displayName(agent);

  return (
    <div className="flex flex-col items-center">
      <div className="relative border border-slate-700/80 rounded-xl px-4 py-3 flex flex-col items-center gap-1 min-w-[110px] bg-slate-900/85 backdrop-blur-sm">
        <div className="text-xl leading-none">{agentInitials(agent)}</div>
        <p className="text-xs font-medium text-white text-center leading-tight max-w-[90px] truncate">{name}</p>
        <p className="text-[10px] text-slate-400 text-center max-w-[90px] truncate">{agent.model?.split("/").pop() || agent.model || "—"}</p>
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ backgroundColor: statusColor(agent.status) }} />
      </div>

      {hasChildren && (
        <>
          <div className="w-px h-6 bg-slate-700" />
          <div className="relative flex items-start justify-center gap-8">
            {agent.subagents.length > 1 && (
              <div className="absolute top-0 left-0 right-0 h-px bg-slate-700" style={{ left: "50px", right: "50px" }} />
            )}
            {agent.subagents.map((sub, i) => {
              const subAgent = typeof sub === "string" ? { id: sub, name: sub, status: "unknown" } : sub;
              return (
                <div key={subAgent.id || i} className="flex flex-col items-center">
                  <div className="w-px h-6 bg-slate-700" />
                  <OrgNode agent={subAgent} depth={depth + 1} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function OrgChart({ agents }) {
  const allSubIds = new Set(
    agents.flatMap(a => (a.subagents || []).map(s => (typeof s === "string" ? s : s?.id)).filter(Boolean))
  );
  const roots = agents.filter(a => !allSubIds.has(a.id));
  const display = roots.length > 0 ? roots : agents;

  return (
    <div className="flex gap-12 justify-center flex-wrap py-8">
      {display.map((agent, i) => <OrgNode key={agent.id || i} agent={agent} />)}
    </div>
  );
}

function TeamInner() {
  const qc = useQueryClient();
  const [view, setView] = useState("office");

  const { data, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: agentsApi.getAll,
    retry: 1,
    staleTime: 30_000,
  });

  useChannel("AgentEventsChannel", () => {
    qc.invalidateQueries({ queryKey: ["agents"] });
  });

  const agents = Array.isArray(data) ? data : [];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950">
      <div className="px-6 pt-6 pb-4 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Waves size={15} className="text-cyan-400/70" />
              <Sparkles size={14} className="text-amber-300/70" />
            </div>
            <h1 className="text-2xl font-bold text-white">Team</h1>
            <p className="text-slate-400 text-sm">{agents.length} station{agents.length !== 1 ? "s" : ""} active in the mission control office</p>
          </div>
          <div className="flex gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setView("office")}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors ${view === "office" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-white"}`}
            >
              <Building2 size={12} /> Office
            </button>
            <button
              onClick={() => setView("org")}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors ${view === "org" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-white"}`}
            >
              <Users size={12} /> Org Chart
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-3 flex items-center gap-5 flex-wrap border-b border-slate-900/80">
        {[
          { status: "active", label: "Active" },
          { status: "idle", label: "Idle" },
          { status: "paused", label: "Paused" },
          { status: "error", label: "Error" },
          { status: "unknown", label: "Unknown" },
        ].map(({ status, label }) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor(status) }} />
            <span className="text-xs text-slate-500">{label}</span>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="p-6 text-slate-400 text-sm">Loading…</div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-600">
          <Bot size={40} className="mb-3 opacity-40" />
          <p className="text-sm">No stations online yet</p>
        </div>
      ) : view === "office" ? (
        <div className="px-6 py-6">
          <div className="relative rounded-2xl border border-slate-800 overflow-hidden bg-slate-950/90">
            <OfficeBackground />
            <div className="relative p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {agents.map((agent, idx) => (
                  <AgentDesk key={agent.id || idx} agent={agent} />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-6 py-4 overflow-x-auto">
          <OrgChart agents={agents} />
        </div>
      )}
    </div>
  );
}

export default function TeamPage() {
  return (
    <ErrorBoundary>
      <TeamInner />
    </ErrorBoundary>
  );
}
