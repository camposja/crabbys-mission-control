import { useQuery } from "@tanstack/react-query";
import {
  X, Loader2, CheckCircle, XCircle, AlertTriangle,
  Clock, CalendarClock, Link2, Bot, FolderOpen, Hash,
  ShieldCheck, ShieldAlert, Info,
} from "lucide-react";
import { calendarApi } from "../../api/calendar";
import { cn } from "../../lib/utils";

// ── Status config (mirrors CalendarPage) ─────────────────────────────────────
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

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatRelative(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const absDiff = Math.abs(diff);
  const future = diff < 0;
  const mins = Math.floor(absDiff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return future ? `in ${mins}m` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return future ? `in ${hrs}h` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return future ? `in ${days}d` : `${days}d ago`;
}

// ── Detail row ───────────────────────────────────────────────────────────────
function DetailRow({ label, children, mono }) {
  if (children == null || children === "") return null;
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-gray-500 shrink-0 w-24">{label}</span>
      <span className={cn("text-sm text-gray-200 text-right", mono && "font-mono text-xs")}>
        {children}
      </span>
    </div>
  );
}

// ── Verification section ─────────────────────────────────────────────────────
function VerificationSection({ eventId, open }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["calendar", "event", "history", eventId],
    queryFn: () => calendarApi.getEventHistory(eventId),
    enabled: open && !!eventId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm py-4 justify-center">
        <Loader2 size={14} className="animate-spin" /> Loading execution history...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-3">
        <div className="flex items-center gap-2 mb-1">
          <XCircle size={13} className="text-red-400 shrink-0" />
          <span className="text-sm text-red-400 font-medium">Could not load execution history</span>
        </div>
        <p className="text-xs text-red-400/70 pl-5">{error?.message || "Unknown error"}</p>
      </div>
    );
  }

  const verification = data?.verification;
  const relevantEvents = data?.relevant_events || [];

  // No verification data at all
  if (!verification && relevantEvents.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-3">
        <div className="flex items-start gap-2">
          <Info size={13} className="text-gray-500 shrink-0 mt-0.5" />
          <p className="text-sm text-gray-400">
            No execution history available.
          </p>
        </div>
      </div>
    );
  }

  // Unverified
  const isUnverified = verification && !verification.verified &&
    verification.verification_source === "unverified";

  return (
    <div className="space-y-3">
      {/* Verification badge */}
      {verification && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {isUnverified ? (
              <>
                <ShieldAlert size={14} className="text-gray-500" />
                <span className="text-sm text-gray-400">Not verified</span>
              </>
            ) : verification.verified ? (
              <>
                <ShieldCheck size={14} className="text-green-400" />
                <span className="text-sm text-green-400">Verified</span>
              </>
            ) : (
              <>
                <ShieldAlert size={14} className="text-orange-400" />
                <span className="text-sm text-orange-400">Verification failed</span>
              </>
            )}

            {verification.verification_source && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-500">
                {verification.verification_source}
              </span>
            )}
          </div>

          {isUnverified && (
            <p className="text-xs text-gray-500 leading-relaxed">
              Execution could not be verified. No task link, agent activity, or gateway data was found for this event.
            </p>
          )}

          {verification.execution_detail && (
            <DetailRow label="Detail">
              {verification.execution_detail}
            </DetailRow>
          )}

          {verification.suggested_status && verification.suggested_status !== data?.status && (
            <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded px-2.5 py-1.5">
              <AlertTriangle size={12} className="text-yellow-400 shrink-0" />
              <span className="text-xs text-yellow-300">
                Verifier suggests: <strong>{verification.suggested_status}</strong>
              </span>
            </div>
          )}

          {verification.checked_at && (
            <p className="text-xs text-gray-600">
              Checked {formatRelative(verification.checked_at)}
            </p>
          )}
        </div>
      )}

      {/* Relevant events timeline */}
      {relevantEvents.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Relevant Events</p>
          <div className="space-y-1.5">
            {relevantEvents.slice(0, 5).map((evt, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400 shrink-0">
                  {evt.event_type || evt.type || "event"}
                </span>
                <span className="text-gray-300 flex-1 min-w-0 truncate">
                  {evt.message || evt.description || "—"}
                </span>
                <span className="text-gray-600 shrink-0">
                  {formatRelative(evt.timestamp || evt.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function CalendarEventDetail({ event, open, onClose }) {
  if (!event) return null;

  const status = EVENT_STATUS[event.status] || EVENT_STATUS.scheduled;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-96 bg-gray-900 border-l border-gray-800 shadow-xl",
          "flex flex-col transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg text-white font-semibold truncate">{event.title}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={cn("w-2 h-2 rounded-full shrink-0", status.dot)} />
              <span className={cn("text-xs px-1.5 py-0.5 rounded border", status.bg, status.color)}>
                {status.label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors shrink-0 mt-1"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* ── Scheduled info ──────────────────────────────────────── */}
          <section>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <CalendarClock size={11} /> Schedule
            </p>
            <div className="divide-y divide-gray-800/60">
              <DetailRow label="Scheduled">{formatDateTime(event.starts_at)}</DetailRow>
              <DetailRow label="Ends">{formatDateTime(event.ends_at) || "\u2014"}</DetailRow>
              <DetailRow label="Source">
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400">
                  {SOURCE_LABELS[event.source] || event.source || "\u2014"}
                </span>
              </DetailRow>
              <DetailRow label="Recurrence">{event.recurrence || "One-time"}</DetailRow>
              {event.next_run_at && (
                <DetailRow label="Next run">{formatDateTime(event.next_run_at)}</DetailRow>
              )}
              {event.last_run_at && (
                <DetailRow label="Last run">{formatRelative(event.last_run_at)}</DetailRow>
              )}
            </div>
          </section>

          {/* ── Links ──────────────────────────────────────────────── */}
          {(event.task || event.agent_id || event.project) && (
            <section>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Link2 size={11} /> Links
              </p>
              <div className="divide-y divide-gray-800/60">
                {event.task && (
                  <DetailRow label="Task">
                    <span className="text-orange-400">{event.task.title || event.task.name}</span>
                  </DetailRow>
                )}
                {event.agent_id && (
                  <DetailRow label="Agent" mono>{event.agent_id}</DetailRow>
                )}
                {event.project && (
                  <DetailRow label="Project">
                    <span className="flex items-center gap-1">
                      <FolderOpen size={11} className="text-gray-500" />
                      {event.project.name}
                    </span>
                  </DetailRow>
                )}
              </div>
            </section>
          )}

          {/* ── Execution verification ─────────────────────────────── */}
          <section>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <ShieldCheck size={11} /> Execution Verification
            </p>
            <VerificationSection eventId={event.id} open={open} />
          </section>

          {/* ── Gateway reference ──────────────────────────────────── */}
          {event.gateway_reference && (
            <section>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <Hash size={11} /> Gateway Reference
              </p>
              <code className="text-xs text-gray-400 font-mono bg-gray-800 rounded px-2 py-1 block break-all">
                {event.gateway_reference}
              </code>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
