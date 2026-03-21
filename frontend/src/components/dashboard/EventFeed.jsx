import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Zap, AlertCircle, Info, CheckCircle, Activity,
  Pause, Play, Filter, X, ChevronDown
} from "lucide-react";
import { useChannel } from "../../hooks/useChannel";
import { dashboardApi } from "../../api/dashboard";
import { cn } from "../../lib/utils";

const EVENT_ICONS = {
  agent_event:    { icon: Zap,           color: "text-orange-400" },
  error:          { icon: AlertCircle,   color: "text-red-400"    },
  task_created:   { icon: CheckCircle,   color: "text-green-400"  },
  task_moved:     { icon: Activity,      color: "text-blue-400"   },
  task_updated:   { icon: Activity,      color: "text-blue-400"   },
  metrics:        { icon: Activity,      color: "text-gray-500"   },
  calendar_event_created: { icon: CheckCircle, color: "text-purple-400" },
  default:        { icon: Info,          color: "text-gray-400"   },
};

export default function EventFeed() {
  const [events,   setEvents]   = useState([]);
  const [paused,   setPaused]   = useState(false);
  const [filter,   setFilter]   = useState({ agent: "", type: "" });
  const [showFilter, setShowFilter] = useState(false);
  const bottomRef  = useRef(null);
  const pausedRef  = useRef(paused);
  pausedRef.current = paused;

  // Load recent events on mount
  const { data: recent } = useQuery({
    queryKey: ["events-recent"],
    queryFn:  () => dashboardApi.getRecentEvents(50),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (recent?.length) setEvents(recent);
  }, [recent]);

  // Live stream via Action Cable
  useChannel("EventsChannel", useCallback((data) => {
    if (pausedRef.current) return;
    // Don't show raw metrics events in feed unless user wants them
    setEvents(prev => [data, ...prev].slice(0, 200));
  }, []));

  // Auto-scroll to bottom when new events arrive (and not paused)
  useEffect(() => {
    if (!paused) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [events, paused]);

  // Get unique agent IDs and event types for filter dropdowns
  const agentIds  = [...new Set(events.map(e => e.agent_id).filter(Boolean))];
  const eventTypes = [...new Set(events.map(e => e.type).filter(Boolean))];

  const filtered = events.filter(ev => {
    if (filter.agent && ev.agent_id !== filter.agent) return false;
    if (filter.type  && ev.type     !== filter.type)  return false;
    return true;
  });

  const clearFilter = () => setFilter({ agent: "", type: "" });
  const hasFilter   = filter.agent || filter.type;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg flex flex-col" style={{ height: "420px" }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2 shrink-0">
        <span className={cn(
          "w-2 h-2 rounded-full shrink-0",
          paused ? "bg-yellow-400" : "bg-green-400 animate-pulse"
        )} />
        <h2 className="text-sm font-semibold text-white flex-1">Live Event Feed</h2>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilter(v => !v)}
          className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors",
            hasFilter ? "text-orange-400 bg-orange-500/10" : "text-gray-500 hover:text-white"
          )}
        >
          <Filter size={11} />
          {hasFilter ? "Filtered" : "Filter"}
        </button>

        {/* Pause / Resume */}
        <button
          onClick={() => setPaused(v => !v)}
          className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors",
            paused
              ? "text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20"
              : "text-gray-500 hover:text-white"
          )}
          title={paused ? "Resume feed" : "Pause feed"}
        >
          {paused ? <><Play size={11} /> Resume</> : <><Pause size={11} /> Pause</>}
        </button>

        <span className="text-xs text-gray-600 ml-1">{filtered.length}</span>
      </div>

      {/* Filter bar */}
      {showFilter && (
        <div className="px-4 py-2 border-b border-gray-800 flex items-center gap-3 shrink-0 bg-gray-950/50">
          <select
            value={filter.agent}
            onChange={e => setFilter(f => ({ ...f, agent: e.target.value }))}
            className="text-xs bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 outline-none"
          >
            <option value="">All agents</option>
            {agentIds.map(id => <option key={id} value={id}>{id}</option>)}
          </select>

          <select
            value={filter.type}
            onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}
            className="text-xs bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 outline-none"
          >
            <option value="">All types</option>
            {eventTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {hasFilter && (
            <button onClick={clearFilter} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white">
              <X size={11} /> Clear
            </button>
          )}
        </div>
      )}

      {/* Feed list — newest at top */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-800/50">
        {paused && (
          <div className="px-4 py-2 bg-yellow-500/5 text-xs text-yellow-400 text-center shrink-0">
            Feed paused — {events.length - filtered.length > 0 ? `${events.length - filtered.length} events filtered` : "click Resume to continue"}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-600 text-sm gap-2">
            <Activity size={24} className="text-gray-700" />
            <p>Waiting for agent activity…</p>
            <p className="text-xs text-gray-700">Events stream here in real time</p>
          </div>
        ) : (
          filtered.map(ev => <EventRow key={ev.id || `${ev.timestamp}-${ev.type}`} event={ev} />)
        )}

        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button (shown when paused) */}
      {paused && (
        <div className="px-4 py-2 border-t border-gray-800 shrink-0">
          <button
            onClick={() => { setPaused(false); bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors"
          >
            <ChevronDown size={11} /> Resume & scroll to latest
          </button>
        </div>
      )}
    </div>
  );
}

function EventRow({ event }) {
  const cfg   = EVENT_ICONS[event.type] || EVENT_ICONS.default;
  const Icon  = cfg.icon;
  const isErr = event.type === "error";

  return (
    <div className={cn(
      "px-4 py-2.5 flex items-start gap-3 hover:bg-gray-800/30 transition-colors",
      isErr && "bg-red-950/20"
    )}>
      <Icon size={12} className={cn("mt-0.5 shrink-0", cfg.color)} />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={cn("text-xs font-medium", isErr ? "text-red-300" : "text-white")}>
            {event.message || event.type}
          </span>
          {event.agent_id && (
            <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded font-mono">
              {event.agent_id}
            </span>
          )}
        </div>
        {event.metadata && Object.keys(event.metadata).length > 0 && !["metrics"].includes(event.type) && (
          <p className="text-xs text-gray-600 mt-0.5 font-mono truncate">
            {JSON.stringify(event.metadata).slice(0, 120)}
          </p>
        )}
      </div>

      <span className="text-xs text-gray-700 shrink-0 tabular-nums">
        {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : ""}
      </span>
    </div>
  );
}
