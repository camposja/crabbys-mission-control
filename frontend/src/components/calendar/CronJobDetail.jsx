import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, Loader2, Play, ToggleLeft, ToggleRight,
  Clock, AlertTriangle, Hash, Link2, FolderOpen,
  CheckCircle, XCircle,
} from "lucide-react";
import { cronJobsApi } from "../../api/cronJobs";
import { cn } from "../../lib/utils";

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

// ── Sync source label ────────────────────────────────────────────────────────
const SYNC_LABELS = {
  gateway: "Gateway",
  local:   "Local",
  manual:  "Manual",
};

// ── Main component ───────────────────────────────────────────────────────────
export default function CronJobDetail({ job, open, onClose }) {
  const qc = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: () => cronJobsApi.toggle(job?.id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["calendar", "cronJobs"] });
      qc.invalidateQueries({ queryKey: ["calendar", "summary"] });
    },
  });

  const runNowMutation = useMutation({
    mutationFn: () => cronJobsApi.runNow(job?.id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["calendar", "cronJobs"] });
      qc.invalidateQueries({ queryKey: ["calendar", "summary"] });
    },
  });

  if (!job) return null;

  const failureCount = job.failure_count || job.failures_count || 0;
  const isEnabled = toggleMutation.data?.enabled ?? job.enabled;

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
            <h2 className="text-lg text-white font-semibold truncate">{job.name}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded border",
                isEnabled
                  ? "bg-green-500/10 border-green-500/20 text-green-400"
                  : "bg-gray-500/10 border-gray-500/20 text-gray-400"
              )}>
                {isEnabled ? "Enabled" : "Disabled"}
              </span>
              {job.status && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400">
                  {job.status}
                </span>
              )}
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

          {/* Cron expression */}
          <section>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Clock size={11} /> Cron Expression
            </p>
            <code className="text-lg text-white font-mono bg-gray-800 rounded-lg px-4 py-3 block text-center tracking-wider">
              {job.cron_expression}
            </code>
          </section>

          {/* Toggle */}
          <section>
            <button
              onClick={() => toggleMutation.mutate()}
              disabled={toggleMutation.isPending}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border transition-colors",
                isEnabled
                  ? "bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20"
                  : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700"
              )}
            >
              {toggleMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : isEnabled ? (
                <ToggleRight size={16} />
              ) : (
                <ToggleLeft size={16} />
              )}
              <span className="text-sm font-medium">
                {isEnabled ? "Enabled" : "Disabled"}
              </span>
              <span className="text-xs text-gray-500 ml-auto">
                Click to {isEnabled ? "disable" : "enable"}
              </span>
            </button>
          </section>

          {/* Schedule info */}
          <section>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Schedule</p>
            <div className="divide-y divide-gray-800/60">
              <DetailRow label="Next run">
                {job.next_run_at ? formatDateTime(job.next_run_at) : "Not scheduled"}
              </DetailRow>
              <DetailRow label="Last run">
                {job.last_run_at ? formatRelative(job.last_run_at) : "\u2014"}
              </DetailRow>
            </div>
          </section>

          {/* Failures */}
          {failureCount > 0 && (
            <section>
              <p className="text-xs text-red-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <AlertTriangle size={11} /> Failures
              </p>
              <div className="bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Failure count</span>
                  <span className="text-sm text-red-400 font-medium">{failureCount}</span>
                </div>
                {(job.last_error || job.last_error_message) && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Last error</p>
                    <pre className="text-xs text-red-300 bg-red-950/50 rounded px-2 py-1.5 whitespace-pre-wrap break-all font-mono leading-relaxed">
                      {job.last_error || job.last_error_message}
                    </pre>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Links */}
          {(job.task || job.agent_id || job.project) && (
            <section>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Link2 size={11} /> Links
              </p>
              <div className="divide-y divide-gray-800/60">
                {job.task && (
                  <DetailRow label="Task">
                    <span className="text-orange-400">{job.task.title || job.task.name}</span>
                  </DetailRow>
                )}
                {job.agent_id && (
                  <DetailRow label="Agent" mono>{job.agent_id}</DetailRow>
                )}
                {job.project && (
                  <DetailRow label="Project">
                    <span className="flex items-center gap-1">
                      <FolderOpen size={11} className="text-gray-500" />
                      {job.project.name}
                    </span>
                  </DetailRow>
                )}
              </div>
            </section>
          )}

          {/* Sync source */}
          {job.sync_source && (
            <section>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Sync Source</p>
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400">
                {SYNC_LABELS[job.sync_source] || job.sync_source}
              </span>
            </section>
          )}

          {/* Gateway reference */}
          {job.gateway_reference && (
            <section>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <Hash size={11} /> Gateway Reference
              </p>
              <code className="text-xs text-gray-400 font-mono bg-gray-800 rounded px-2 py-1 block break-all">
                {job.gateway_reference}
              </code>
            </section>
          )}
        </div>

        {/* Footer: Run Now */}
        <div className="px-5 py-4 border-t border-gray-800 flex items-center gap-3">
          <button
            onClick={() => runNowMutation.mutate()}
            disabled={runNowMutation.isPending}
            className="flex items-center gap-1.5 text-sm bg-orange-500/20 hover:bg-orange-500/30 disabled:opacity-50 text-orange-400 px-4 py-2 rounded-lg transition-colors font-medium"
          >
            {runNowMutation.isPending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Play size={13} />
            )}
            {runNowMutation.isPending ? "Running..." : "Run Now"}
          </button>
          {runNowMutation.isSuccess && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle size={12} /> Triggered
            </span>
          )}
          {runNowMutation.isError && (
            <span className="flex items-center gap-1 text-xs text-red-400" title={runNowMutation.error?.message}>
              <XCircle size={12} /> {runNowMutation.error?.message || "Error"}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
