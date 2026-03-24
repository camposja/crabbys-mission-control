import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Loader2 } from "lucide-react";
import { calendarApi } from "../../api/calendar";
import { cn } from "../../lib/utils";
import CalendarEventDetail from "./CalendarEventDetail";
import CronJobDetail from "./CronJobDetail";

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  scheduled: { label: "Scheduled", color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20",     dot: "bg-blue-500"   },
  running:   { label: "Running",   color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", dot: "bg-yellow-500" },
  completed: { label: "Completed", color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20",   dot: "bg-green-500"  },
  failed:    { label: "Failed",    color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",       dot: "bg-red-500"    },
  missed:    { label: "Missed",    color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", dot: "bg-orange-500" },
  cancelled: { label: "Cancelled", color: "text-gray-400",   bg: "bg-gray-500/10 border-gray-500/20",     dot: "bg-gray-500"   },
  idle:      { label: "Scheduled", color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20",     dot: "bg-blue-500"   },
  active:    { label: "Active",    color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", dot: "bg-yellow-500" },
  paused:    { label: "Paused",    color: "text-gray-400",   bg: "bg-gray-500/10 border-gray-500/20",     dot: "bg-gray-500"   },
};

const SOURCE_LABELS = {
  cron_job:      "Cron",
  task_run:      "Task",
  manual:        "Manual",
  proactive_job: "Proactive",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatTodayHeader() {
  const now = new Date();
  return now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ── Row component ────────────────────────────────────────────────────────────
function TodayRow({ item, onClick }) {
  const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.scheduled;
  const sourceLabel = SOURCE_LABELS[item.source] || item.source || "";

  return (
    <div
      className="flex items-start gap-4 px-4 py-3 hover:bg-gray-800/60 transition-colors cursor-pointer"
      onClick={onClick}
    >
      {/* Time */}
      <span className="text-xs text-gray-500 font-mono shrink-0 w-14 mt-0.5 text-right">
        {formatTime(item.starts_at)}
      </span>

      {/* Status badge */}
      <span className={cn("text-xs px-1.5 py-0.5 rounded border shrink-0 mt-0.5", status.bg, status.color)}>
        {status.label}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-white font-medium truncate">{item.title}</span>
          {sourceLabel && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400">
              {sourceLabel}
            </span>
          )}
        </div>
        {/* Sub-details */}
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 flex-wrap">
          {item.task && (
            <span>Task: {item.task.title || item.task.name}</span>
          )}
          {item.agent_id && (
            <>
              {item.task && <span>&middot;</span>}
              <span className="font-mono truncate max-w-[140px]">Agent: {item.agent_id}</span>
            </>
          )}
          {item.cron_expression && (
            <>
              <span>&middot;</span>
              <code className="font-mono text-gray-600">{item.cron_expression}</code>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function TodayCalendarView() {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedCronJob, setSelectedCronJob] = useState(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["calendar", "today"],
    queryFn: () => calendarApi.getToday(),
  });

  const items = useMemo(() => {
    if (!data) return [];
    const allItems = [
      ...(data.events || []),
      ...(data.cron_occurrences || []),
    ];
    return allItems.sort((a, b) => (a.starts_at || "").localeCompare(b.starts_at || ""));
  }, [data]);

  function handleItemClick(item) {
    if (typeof item.id === "string" && item.id.startsWith("cron-")) {
      setSelectedCronJob({ id: item.cron_job_id, name: item.title, cron_expression: item.cron_expression, ...item });
    } else if (item.cron_job_id) {
      setSelectedCronJob({ id: item.cron_job_id, name: item.title, cron_expression: item.cron_expression, ...item });
    } else {
      setSelectedEvent(item);
    }
  }

  return (
    <div>
      {/* Header */}
      <h3 className="text-sm font-semibold text-white mb-4">
        Today &mdash; {formatTodayHeader()}
      </h3>

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-12 justify-center">
          <Loader2 size={14} className="animate-spin" /> Loading today&apos;s schedule...
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2 bg-red-950/50 border border-red-800 rounded-lg px-4 py-3">
          <span className="text-sm text-red-400">{error?.message || "Failed to load today view"}</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-600">
          <CheckCircle size={36} className="mb-3 text-green-500/40" />
          <p className="text-sm text-green-400">No scheduled OpenClaw work today</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800/60">
          {items.map((item, i) => (
            <TodayRow
              key={item.id || i}
              item={item}
              onClick={() => handleItemClick(item)}
            />
          ))}
        </div>
      )}

      <CalendarEventDetail
        event={selectedEvent}
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
      <CronJobDetail
        job={selectedCronJob}
        open={!!selectedCronJob}
        onClose={() => setSelectedCronJob(null)}
      />
    </div>
  );
}
