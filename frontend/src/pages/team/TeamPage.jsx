import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../../api/agents";
import { useChannel } from "../../hooks/useChannel";
import { useQueryClient } from "@tanstack/react-query";
import { Users, Building2, Bot, Circle } from "lucide-react";
import ErrorBoundary from "../../components/ui/ErrorBoundary";

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status) {
  switch (status) {
    case "active":  return "#4ade80"; // green
    case "paused":  return "#facc15"; // yellow
    case "idle":    return "#60a5fa"; // blue
    case "error":   return "#f87171"; // red
    default:        return "#374151"; // gray
  }
}

function agentInitials(agent) {
  const name = agent.name || agent.id || "?";
  if (name.toLowerCase() === "crabby") return "🦀";
  if (name.toLowerCase() === "jose" || name.toLowerCase() === "main") return "J";
  return name.slice(0, 2).toUpperCase();
}

function agentBgColor(agent) {
  const name = (agent.name || agent.id || "").toLowerCase();
  if (name === "crabby") return "bg-orange-500/30 border-orange-500/50";
  if (name === "jose" || name === "main") return "bg-blue-500/30 border-blue-500/50";
  return "bg-gray-700/60 border-gray-600/50";
}

// ── Org Chart ─────────────────────────────────────────────────────────────────

function OrgNode({ agent, depth = 0 }) {
  const hasChildren = agent.subagents?.length > 0;

  return (
    <div className="flex flex-col items-center">
      {/* Card */}
      <div className={`relative border rounded-xl px-4 py-3 flex flex-col items-center gap-1 min-w-[100px] ${agentBgColor(agent)}`}>
        <div className="text-xl font-bold text-white leading-none">{agentInitials(agent)}</div>
        <p className="text-xs font-medium text-white text-center leading-tight max-w-[80px] truncate">
          {agent.name || agent.id}
        </p>
        <p className="text-[10px] text-gray-400 text-center max-w-[80px] truncate">
          {agent.model?.split("/").pop() || agent.model || "—"}
        </p>
        {/* Status dot */}
        <div
          className="absolute top-2 right-2 w-2 h-2 rounded-full"
          style={{ backgroundColor: statusColor(agent.status) }}
        />
      </div>

      {/* Children */}
      {hasChildren && (
        <>
          {/* Vertical connector */}
          <div className="w-px h-6 bg-gray-700" />
          {/* Horizontal bar */}
          <div className="relative flex items-start justify-center gap-8">
            {agent.subagents.length > 1 && (
              <div
                className="absolute top-0 left-0 right-0 h-px bg-gray-700"
                style={{ left: "50px", right: "50px" }}
              />
            )}
            {agent.subagents.map((sub, i) => {
              const subAgent = typeof sub === "string" ? { id: sub, name: sub, status: "unknown" } : sub;
              return (
                <div key={subAgent.id || i} className="flex flex-col items-center">
                  <div className="w-px h-6 bg-gray-700" />
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
  // Find root agents (those not referenced as subagent of another)
  const allSubIds = new Set(
    agents.flatMap(a =>
      (a.subagents || []).map(s => (typeof s === "string" ? s : s?.id)).filter(Boolean)
    )
  );
  const roots = agents.filter(a => !allSubIds.has(a.id));
  const display = roots.length > 0 ? roots : agents;

  return (
    <div className="flex gap-12 justify-center flex-wrap py-8">
      {display.map((agent, i) => (
        <OrgNode key={agent.id || i} agent={agent} />
      ))}
    </div>
  );
}

// ── Pixel-art Office ──────────────────────────────────────────────────────────

const DESK_POSITIONS = [
  { x: 60,  y: 80  },
  { x: 220, y: 80  },
  { x: 380, y: 80  },
  { x: 60,  y: 230 },
  { x: 220, y: 230 },
  { x: 380, y: 230 },
  { x: 60,  y: 380 },
  { x: 220, y: 380 },
];

function PixelAvatar({ agent, x, y }) {
  const name     = agent.name || agent.id || "?";
  const initials = agentInitials(agent);
  const color    = statusColor(agent.status);
  const isCrabby = name.toLowerCase() === "crabby";
  const isJose   = name.toLowerCase() === "jose" || name.toLowerCase() === "main";

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Desk */}
      <rect x="0" y="28" width="64" height="36" rx="3" fill="#1f2937" stroke="#374151" strokeWidth="1" />
      <rect x="8" y="32" width="48" height="24" rx="2" fill="#111827" stroke="#374151" strokeWidth="0.5" />
      {/* Monitor glow */}
      <rect x="12" y="35" width="40" height="18" rx="1" fill="#0f172a" opacity="0.6" />
      <rect x="14" y="37" width="36" height="14" rx="1" fill={isCrabby ? "#7c2d12" : isJose ? "#1e3a5f" : "#1f2937"} opacity="0.8" />
      {/* Desk lamp */}
      <line x1="54" y1="28" x2="54" y2="20" stroke="#4b5563" strokeWidth="1.5" />
      <circle cx="54" cy="19" r="3" fill="#fbbf24" opacity="0.7" />

      {/* Agent avatar circle */}
      <circle cx="32" cy="18" r="14"
        fill={isCrabby ? "#ea580c" : isJose ? "#3b82f6" : "#6b7280"}
        stroke="#111827" strokeWidth="2"
      />
      <text x="32" y="23" textAnchor="middle" fill="white" fontSize={isCrabby ? "14" : "10"} fontWeight="bold">
        {initials}
      </text>

      {/* Status dot */}
      <circle cx="42" cy="8" r="4" fill={color} stroke="#111827" strokeWidth="1.5" />

      {/* Name label */}
      <text x="32" y="76" textAnchor="middle" fill="#9ca3af" fontSize="9" fontFamily="monospace">
        {name.length > 8 ? name.slice(0, 7) + "…" : name}
      </text>
    </g>
  );
}

function OfficeView({ agents }) {
  const visibleAgents = agents.slice(0, DESK_POSITIONS.length);
  const extra = agents.length - visibleAgents.length;

  return (
    <div className="w-full overflow-x-auto">
      <div className="relative inline-block min-w-[520px]">
        <svg
          viewBox="0 0 520 500"
          className="w-full"
          style={{ maxHeight: 480 }}
        >
          {/* Floor */}
          <rect x="0" y="0" width="520" height="500" fill="#0f172a" />

          {/* Floor tiles */}
          {Array.from({ length: 10 }).map((_, col) =>
            Array.from({ length: 9 }).map((_, row) => (
              <rect
                key={`${col}-${row}`}
                x={col * 52}
                y={row * 56}
                width="51"
                height="55"
                fill="none"
                stroke="#1e293b"
                strokeWidth="0.5"
              />
            ))
          )}

          {/* Plant in corner */}
          <circle cx="490" cy="480" r="20" fill="#14532d" />
          <circle cx="490" cy="462" r="10" fill="#166534" />
          <circle cx="478" cy="468" r="8"  fill="#15803d" />
          <circle cx="498" cy="465" r="9"  fill="#16a34a" />

          {/* Water cooler */}
          <rect x="10" y="440" width="24" height="40" rx="3" fill="#1d4ed8" opacity="0.7" />
          <rect x="13" y="435" width="18" height="10" rx="2" fill="#3b82f6" opacity="0.5" />
          <circle cx="22" cy="458" r="5" fill="#93c5fd" opacity="0.4" />

          {/* Agents at desks */}
          {visibleAgents.map((agent, i) => {
            const pos = DESK_POSITIONS[i];
            return <PixelAvatar key={agent.id || i} agent={agent} x={pos.x} y={pos.y} />;
          })}

          {/* +N more label */}
          {extra > 0 && (
            <text x="460" y="30" fill="#6b7280" fontSize="11" fontFamily="monospace">
              +{extra} more
            </text>
          )}

          {/* Office sign */}
          <text x="260" y="498" textAnchor="middle" fill="#374151" fontSize="10" fontFamily="monospace" letterSpacing="3">
            CRABBY HQ
          </text>
        </svg>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function TeamInner() {
  const qc = useQueryClient();
  const [view, setView] = useState("office"); // "office" | "org"

  const { data, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn:  agentsApi.getAll,
    retry: 1,
    staleTime: 30_000,
  });

  useChannel("AgentEventsChannel", () => {
    qc.invalidateQueries({ queryKey: ["agents"] });
  });

  const agents = Array.isArray(data) ? data : [];

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Team</h1>
            <p className="text-gray-400 text-sm">
              {agents.length} agent{agents.length !== 1 ? "s" : ""} in the hive
            </p>
          </div>
          <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
            <button
              onClick={() => setView("office")}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors ${
                view === "office" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-white"
              }`}
            >
              <Building2 size={12} /> Office
            </button>
            <button
              onClick={() => setView("org")}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors ${
                view === "org" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-white"
              }`}
            >
              <Users size={12} /> Org Chart
            </button>
          </div>
        </div>
      </div>

      {/* Status legend */}
      <div className="px-6 py-3 flex items-center gap-5">
        {[
          { status: "active",  label: "Active"  },
          { status: "idle",    label: "Idle"    },
          { status: "paused",  label: "Paused"  },
          { status: "error",   label: "Error"   },
          { status: "unknown", label: "Unknown" },
        ].map(({ status, label }) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor(status) }} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="p-6 text-gray-400 text-sm">Loading…</div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-600">
          <Bot size={40} className="mb-3 opacity-40" />
          <p className="text-sm">No agents yet</p>
        </div>
      ) : view === "office" ? (
        <div className="px-6 py-4">
          <OfficeView agents={agents} />
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
