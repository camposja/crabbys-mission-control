import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentsApi } from "../../api/agents";
import { useChannel } from "../../hooks/useChannel";
import {
  Bot, Circle, Pause, Play, Trash2, ChevronRight, ChevronDown,
  Cpu, MessageSquare, X,
} from "lucide-react";
import ErrorBoundary from "../../components/ui/ErrorBoundary";

function statusColor(status) {
  switch (status) {
    case "active":  return "text-green-400 fill-green-400";
    case "paused":  return "text-yellow-400 fill-yellow-400";
    case "idle":    return "text-blue-400 fill-blue-400";
    case "error":   return "text-red-400 fill-red-400";
    default:        return "text-gray-600 fill-gray-600";
  }
}

function statusLabel(status) {
  return status || "unknown";
}

function AgentActions({ agent, onClose }) {
  const qc = useQueryClient();
  const opts = {
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      onClose?.();
    },
  };
  const pause     = useMutation({ mutationFn: () => agentsApi.pause(agent.id),     ...opts });
  const resume    = useMutation({ mutationFn: () => agentsApi.resume(agent.id),    ...opts });
  const terminate = useMutation({ mutationFn: () => agentsApi.terminate(agent.id), ...opts });

  const isPaused = agent.status === "paused";
  const busy     = pause.isPending || resume.isPending || terminate.isPending;

  return (
    <div className="flex items-center gap-2">
      {isPaused ? (
        <button
          onClick={() => resume.mutate()}
          disabled={busy}
          title="Resume"
          className="flex items-center gap-1 text-xs bg-green-500/20 hover:bg-green-500/30 text-green-400 px-2 py-1 rounded transition-colors disabled:opacity-50"
        >
          <Play size={11} /> Resume
        </button>
      ) : (
        <button
          onClick={() => pause.mutate()}
          disabled={busy}
          title="Pause"
          className="flex items-center gap-1 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-2 py-1 rounded transition-colors disabled:opacity-50"
        >
          <Pause size={11} /> Pause
        </button>
      )}
      <button
        onClick={() => {
          if (window.confirm(`Terminate agent "${agent.name || agent.id}"?`)) {
            terminate.mutate();
          }
        }}
        disabled={busy}
        title="Terminate"
        className="flex items-center gap-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 px-2 py-1 rounded transition-colors disabled:opacity-50"
      >
        <Trash2 size={11} /> Terminate
      </button>
    </div>
  );
}

function AgentDetailPanel({ agent, onClose }) {
  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-gray-900 border-l border-gray-800 z-40 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500/20 rounded-full flex items-center justify-center">
            <Bot size={16} className="text-orange-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{agent.name || agent.id}</p>
            <p className="text-xs text-gray-500 capitalize">{statusLabel(agent.status)}</p>
          </div>
          <Circle size={8} className={`ml-1 ${statusColor(agent.status)}`} />
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Model */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Model</p>
          <div className="flex items-center gap-2">
            <Cpu size={13} className="text-gray-600" />
            <span className="text-sm text-gray-300">{agent.model || "—"}</span>
          </div>
        </div>

        {/* Description */}
        {agent.description && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Description</p>
            <p className="text-sm text-gray-300">{agent.description}</p>
          </div>
        )}

        {/* Current task */}
        {agent.current_task && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Current Task</p>
            <p className="text-sm text-gray-300">{agent.current_task}</p>
          </div>
        )}

        {/* Channels */}
        {agent.channels?.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Channels</p>
            <div className="flex flex-wrap gap-1.5">
              {agent.channels.map((ch, i) => (
                <span key={i} className="flex items-center gap-1 text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                  <MessageSquare size={10} /> {ch}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Subagents */}
        {agent.subagents?.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Subagents</p>
            <div className="space-y-1">
              {agent.subagents.map((sub, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-400">
                  <ChevronRight size={12} className="text-gray-600" />
                  {typeof sub === "string" ? sub : (sub.name || sub.id || JSON.stringify(sub))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions footer */}
      <div className="px-5 py-4 border-t border-gray-800">
        <AgentActions agent={agent} onClose={onClose} />
      </div>
    </div>
  );
}

function AgentRow({ agent, depth = 0, onSelect, selected }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = agent.subagents?.length > 0;
  const isSelected  = selected?.id === agent.id;

  return (
    <>
      <div
        onClick={() => onSelect(agent)}
        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer rounded-md transition-colors ${
          isSelected ? "bg-orange-500/10 border border-orange-500/30" : "hover:bg-gray-800/60 border border-transparent"
        }`}
        style={{ paddingLeft: `${16 + depth * 20}px` }}
      >
        {/* Expand toggle */}
        <button
          onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          className={`text-gray-600 hover:text-gray-400 transition-colors ${!hasChildren ? "invisible" : ""}`}
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>

        {/* Avatar */}
        <div className="w-7 h-7 bg-gray-800 rounded-full flex items-center justify-center shrink-0">
          <Bot size={13} className="text-orange-400" />
        </div>

        {/* Name / model */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate">{agent.name || agent.id}</p>
          {agent.model && (
            <p className="text-xs text-gray-600 truncate">{agent.model}</p>
          )}
        </div>

        {/* Status dot */}
        <Circle size={7} className={`shrink-0 ${statusColor(agent.status)}`} />

        {/* Status label */}
        <span className="text-xs text-gray-500 capitalize shrink-0 w-16 text-right">
          {statusLabel(agent.status)}
        </span>
      </div>

      {/* Subagents */}
      {expanded && hasChildren && agent.subagents.map((sub, i) => {
        if (typeof sub === "string") {
          return (
            <div
              key={i}
              className="flex items-center gap-2 py-1.5 text-xs text-gray-600"
              style={{ paddingLeft: `${36 + (depth + 1) * 20}px` }}
            >
              <ChevronRight size={10} /> {sub}
            </div>
          );
        }
        return (
          <AgentRow
            key={sub.id || i}
            agent={sub}
            depth={depth + 1}
            onSelect={onSelect}
            selected={selected}
          />
        );
      })}
    </>
  );
}

function AgentsInner() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["agents"],
    queryFn:  agentsApi.getAll,
    retry: 1,
  });

  useChannel("AgentEventsChannel", () => {
    qc.invalidateQueries({ queryKey: ["agents"] });
  });

  if (isLoading) {
    return <div className="p-6 text-gray-400 text-sm">Loading agents…</div>;
  }

  if (isError) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white mb-3">Agents</h1>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-sm text-yellow-400">
          Could not reach OpenClaw gateway. Ensure the gateway is running on port 18789.
        </div>
      </div>
    );
  }

  const agents = Array.isArray(data) ? data : [];
  const activeCount = agents.filter(a => a.status === "active").length;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Main panel */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all ${selected ? "mr-96" : ""}`}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-800 shrink-0">
          <h1 className="text-2xl font-bold text-white mb-1">Agents</h1>
          <p className="text-gray-400 text-sm">
            {agents.length} agent{agents.length !== 1 ? "s" : ""} —{" "}
            <span className="text-green-400">{activeCount} active</span>
          </p>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-600">
              <Bot size={32} className="mb-3 opacity-40" />
              <p className="text-sm">No agents found</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {agents.map((agent, i) => (
                <AgentRow
                  key={agent.id || i}
                  agent={agent}
                  onSelect={a => setSelected(prev => prev?.id === a.id ? null : a)}
                  selected={selected}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <AgentDetailPanel
          agent={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

export default function AgentsPage() {
  return (
    <ErrorBoundary>
      <AgentsInner />
    </ErrorBoundary>
  );
}
