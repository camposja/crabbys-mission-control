import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar, Clock, RefreshCw, Play, ToggleLeft, ToggleRight,
  AlertTriangle, CheckCircle, XCircle, ChevronDown,
  Loader2, CalendarClock, Timer, Ban, CircleDot,
} from "lucide-react";
import { calendarApi } from "../../api/calendar";
import { cronJobsApi } from "../../api/cronJobs";
import { cn } from "../../lib/utils";
import ErrorBoundary from "../../components/ui/ErrorBoundary";
import CalendarEventDetail from "../../components/calendar/CalendarEventDetail";
import CronJobDetail from "../../components/calendar/CronJobDetail";

// ── Status config ────────────────────────────────────────────────────────────
const EVENT_STATUS = {
  scheduled: { label: "Scheduled", color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20",     dot: "bg-blue-500"   },
  running:   { label: "Running",   color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", dot: "bg-yellow-500" },
  completed: { label: "Completed", color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20",   dot: "bg-green-500"  },
  failed:    { label: "Failed",    color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",       dot: "bg-red-500"    },
  missed:    { label: "Missed",    color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", dot: "bg-orange-500" },
  cancelled: { label: "Cancelled", color: "text-gray-400",   bg: "bg-gray-500/10 border-gray-500/20",     dot: "bg-gray-500"   },
};

const SOURCE_LABELS = {
  cron_job:      "Cron",
  task_run:      "Task",
  manual:        "Manual",
  proactive_job: "Proactive",
};

const STATUS_OPTIONS  = ["all", "scheduled", "running", "completed", "failed", "missed", "cancelled"];
const SOURCE_OPTIONS  = ["all", "cron_job", "task_run", "manual", "proactive_job"];

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatRelative(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function dateKey(iso) {
  return new Date(iso).toISOString().split("T")[0];
}

function dateLabelForKey(key) {
  const d = new Date(key + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === tomorrow.getTime()) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function toISODate(date) {
  return date.toISOString().split("T")[0];
}

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("p-1.5 rounded", bg || "bg-gray-800")}>
          <Icon size={13} className={color} />
        </div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white">{value ?? "—"}</p>
    </div>
  );
}

// ── Summary strip ────────────────────────────────────────────────────────────
function SummaryStrip({ summary, isLoading }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-4 animate-pulse">
            <div className="h-3 w-20 bg-gray-800 rounded mb-3" />
            <div className="h-7 w-12 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    { icon: CalendarClock, label: "Upcoming (24h)", value: summary?.upcoming_24h ?? 0, color: "text-blue-400",   bg: "bg-blue-500/10"   },
    { icon: Timer,         label: "Active Cron Jobs", value: summary?.active_cron_jobs ?? 0, color: "text-green-400",  bg: "bg-green-500/10"  },
    { icon: XCircle,       label: "Failed",          value: summary?.failed ?? 0,          color: "text-red-400",    bg: "bg-red-500/10"    },
    { icon: Ban,           label: "Missed",          value: summary?.missed ?? 0,          color: "text-orange-400", bg: "bg-orange-500/10" },
  ];

  const sync = summary?.gateway_sync;

  return (
    <div className="mb-5 space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => <StatCard key={c.label} {...c} />)}
      </div>

      {sync && !sync.gateway_supports_schedule && (
        <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-2.5">
          <AlertTriangle size={14} className="text-yellow-400 shrink-0" />
          <p className="text-sm text-yellow-300">
            Gateway schedule sync unavailable — showing locally defined jobs only
          </p>
        </div>
      )}

      {sync?.last_synced_at && sync.gateway_supports_schedule && (
        <p className="text-xs text-gray-600 px-1">
          Last synced {formatRelative(sync.last_synced_at)}
        </p>
      )}
    </div>
  );
}

// ── Filter bar ───────────────────────────────────────────────────────────────
function FilterBar({ statusFilter, setStatusFilter, sourceFilter, setSourceFilter }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-sm text-gray-400">Filters:</span>
      <div className="relative">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="appearance-none bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-1.5 pr-7 focus:outline-none focus:border-orange-500 cursor-pointer"
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>
              {s === "all" ? "All Statuses" : EVENT_STATUS[s]?.label || s}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      </div>
      <div className="relative">
        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
          className="appearance-none bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-1.5 pr-7 focus:outline-none focus:border-orange-500 cursor-pointer"
        >
          {SOURCE_OPTIONS.map(s => (
            <option key={s} value={s}>
              {s === "all" ? "All Sources" : SOURCE_LABELS[s] || s}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      </div>
    </div>
  );
}

// ── Event row ────────────────────────────────────────────────────────────────
function EventRow({ event, onClick }) {
  const status = EVENT_STATUS[event.status] || EVENT_STATUS.scheduled;

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 hover:bg-gray-800/60 transition-colors rounded-lg cursor-pointer"
      onClick={onClick}
    >
      {/* Status dot */}
      <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", status.dot)} />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-white font-medium truncate">{event.title}</span>
          <span className={cn("text-xs px-1.5 py-0.5 rounded border", status.bg, status.color)}>
            {status.label}
          </span>
          {event.source && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400">
              {SOURCE_LABELS[event.source] || event.source}
            </span>
          )}
          {event.agent_id && (
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-500 truncate max-w-[120px]">
              {event.agent_id}
            </span>
          )}
        </div>
        {event.task && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            Task: {event.task.title || event.task.name}
          </p>
        )}
        {event.project && (
          <p className="text-xs text-gray-600 mt-0.5 truncate">
            Project: {event.project.name}
          </p>
        )}
      </div>

      {/* Time */}
      <span className="text-xs text-gray-500 shrink-0 mt-0.5 font-mono">
        {formatTime(event.starts_at)}
      </span>
    </div>
  );
}

// ── Events tab ───────────────────────────────────────────────────────────────
function EventsTab() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState(null);

  const today = useMemo(() => new Date(), []);
  const endDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 30);
    return d;
  }, [today]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["calendar", "events", { start_date: toISODate(today), end_date: toISODate(endDate) }],
    queryFn: () => calendarApi.getEvents({ start_date: toISODate(today), end_date: toISODate(endDate) }),
  });

  const events = useMemo(() => {
    let list = data?.events || data || [];
    if (!Array.isArray(list)) list = [];
    if (statusFilter !== "all") list = list.filter(e => e.status === statusFilter);
    if (sourceFilter !== "all") list = list.filter(e => e.source === sourceFilter);
    return list;
  }, [data, statusFilter, sourceFilter]);

  const grouped = useMemo(() => {
    const groups = {};
    events.forEach(evt => {
      const key = evt.starts_at ? dateKey(evt.starts_at) : "unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(evt);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  if (isError) {
    return (
      <div className="flex items-center gap-2 bg-red-950/50 border border-red-800 rounded-lg px-4 py-3">
        <XCircle size={14} className="text-red-400 shrink-0" />
        <p className="text-sm text-red-400">{error?.message || "Failed to load events"}</p>
      </div>
    );
  }

  return (
    <div>
      <FilterBar
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        sourceFilter={sourceFilter}
        setSourceFilter={setSourceFilter}
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-8 justify-center">
          <Loader2 size={14} className="animate-spin" /> Loading events...
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-600">
          <Calendar size={36} className="mb-3 opacity-40" />
          <p className="text-sm">No scheduled work in this range</p>
          <p className="text-xs mt-1 text-gray-700">Events will appear here when cron jobs, tasks, or manual work is scheduled</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([key, evts]) => (
            <div key={key}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">
                {dateLabelForKey(key)}
              </h3>
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800/60">
                {evts.map((evt, i) => (
                  <EventRow key={evt.id || i} event={evt} onClick={() => setSelectedEvent(evt)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <CalendarEventDetail
        event={selectedEvent}
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}

// ── Cron job row ─────────────────────────────────────────────────────────────
function CronJobRow({ job, onSelect }) {
  const qc = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: () => cronJobsApi.toggle(job.id),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["calendar", "cronJobs"] });
      const prev = qc.getQueryData(["calendar", "cronJobs"]);
      qc.setQueryData(["calendar", "cronJobs"], old => {
        if (!old) return old;
        const list = Array.isArray(old) ? old : old.cron_jobs || [];
        const updated = list.map(j => j.id === job.id ? { ...j, enabled: !j.enabled } : j);
        return Array.isArray(old) ? updated : { ...old, cron_jobs: updated };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["calendar", "cronJobs"], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["calendar", "cronJobs"] });
      qc.invalidateQueries({ queryKey: ["calendar", "summary"] });
    },
  });

  const runNowMutation = useMutation({
    mutationFn: () => cronJobsApi.runNow(job.id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["calendar", "cronJobs"] });
      qc.invalidateQueries({ queryKey: ["calendar", "summary"] });
    },
  });

  const ToggleIcon = job.enabled ? ToggleRight : ToggleLeft;

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-800/60 transition-colors cursor-pointer" onClick={onSelect}>
      {/* Toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleMutation.mutate(); }}
        disabled={toggleMutation.isPending}
        className={cn(
          "shrink-0 transition-colors",
          job.enabled ? "text-green-400 hover:text-green-300" : "text-gray-600 hover:text-gray-400"
        )}
        title={job.enabled ? "Disable" : "Enable"}
      >
        <ToggleIcon size={20} />
      </button>

      {/* Name + cron */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium truncate", job.enabled ? "text-white" : "text-gray-500")}>
          {job.name}
        </p>
        <code className="text-xs text-gray-500 font-mono">{job.cron_expression}</code>
      </div>

      {/* Next run */}
      <div className="text-right shrink-0 w-28">
        <p className="text-xs text-gray-500">Next run</p>
        <p className="text-xs text-gray-300 font-mono">
          {job.next_run_at ? formatTime(job.next_run_at) : "—"}
        </p>
      </div>

      {/* Last run */}
      <div className="text-right shrink-0 w-24">
        <p className="text-xs text-gray-500">Last run</p>
        <p className="text-xs text-gray-300">
          {job.last_run_at ? formatRelative(job.last_run_at) : "—"}
        </p>
      </div>

      {/* Failure count */}
      {(job.failure_count > 0 || job.failures_count > 0) && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 shrink-0">
          {job.failure_count || job.failures_count} failed
        </span>
      )}

      {/* Run now */}
      <button
        onClick={(e) => { e.stopPropagation(); runNowMutation.mutate(); }}
        disabled={runNowMutation.isPending}
        className="flex items-center gap-1.5 text-xs bg-orange-500/20 hover:bg-orange-500/30 disabled:opacity-50 text-orange-400 px-2.5 py-1.5 rounded transition-colors shrink-0"
      >
        {runNowMutation.isPending ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <Play size={11} />
        )}
        {runNowMutation.isPending ? "Running..." : "Run Now"}
      </button>

      {/* Run now result feedback */}
      {runNowMutation.isSuccess && (
        <CheckCircle size={14} className="text-green-400 shrink-0" />
      )}
      {runNowMutation.isError && (
        <span className="text-xs text-red-400 shrink-0" title={runNowMutation.error?.message}>
          Error
        </span>
      )}
    </div>
  );
}

// ── Cron jobs tab ────────────────────────────────────────────────────────────
function CronJobsTab() {
  const [selectedJob, setSelectedJob] = useState(null);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["calendar", "cronJobs"],
    queryFn: cronJobsApi.getAll,
  });

  const jobs = useMemo(() => {
    if (!data) return [];
    return Array.isArray(data) ? data : data.cron_jobs || [];
  }, [data]);

  if (isError) {
    return (
      <div className="flex items-center gap-2 bg-red-950/50 border border-red-800 rounded-lg px-4 py-3">
        <XCircle size={14} className="text-red-400 shrink-0" />
        <p className="text-sm text-red-400">{error?.message || "Failed to load cron jobs"}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm py-8 justify-center">
        <Loader2 size={14} className="animate-spin" /> Loading cron jobs...
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-600">
        <RefreshCw size={36} className="mb-3 opacity-40" />
        <p className="text-sm">No cron jobs defined</p>
        <p className="text-xs mt-1 text-gray-700">Cron jobs run scheduled work automatically on a recurring basis</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800">
        {jobs.map(job => (
          <CronJobRow key={job.id} job={job} onSelect={() => setSelectedJob(job)} />
        ))}
      </div>
      <CronJobDetail
        job={selectedJob}
        open={!!selectedJob}
        onClose={() => setSelectedJob(null)}
      />
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
function CalendarInner() {
  const [tab, setTab] = useState("events");

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["calendar", "summary"],
    queryFn: calendarApi.getSummary,
  });

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-3">Calendar</h1>
        <div className="flex gap-1 bg-gray-800 p-1 rounded-lg w-fit">
          <button
            onClick={() => setTab("events")}
            className={cn(
              "flex items-center gap-1.5 text-xs px-4 py-2 rounded-md transition-colors",
              tab === "events" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-white"
            )}
          >
            <Calendar size={12} /> Scheduled Events
          </button>
          <button
            onClick={() => setTab("cron")}
            className={cn(
              "flex items-center gap-1.5 text-xs px-4 py-2 rounded-md transition-colors",
              tab === "cron" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-white"
            )}
          >
            <Clock size={12} /> Cron Jobs
          </button>
        </div>
      </div>

      <div className="px-6 py-6">
        <SummaryStrip summary={summary} isLoading={loadingSummary} />
        {tab === "events" ? <EventsTab /> : <CronJobsTab />}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <ErrorBoundary>
      <CalendarInner />
    </ErrorBoundary>
  );
}
