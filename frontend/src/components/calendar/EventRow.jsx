import { cn } from "../../lib/utils";

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

function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export { EVENT_STATUS, SOURCE_LABELS, formatTime };

export default function EventRow({ event, onClick, showProject = false }) {
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
          {showProject && event.project && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-900 border border-indigo-700 text-indigo-300">
              {event.project.name || event.project.title}
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
        {!showProject && event.project && (
          <p className="text-xs text-gray-600 mt-0.5 truncate">
            Project: {event.project.name || event.project.title}
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
