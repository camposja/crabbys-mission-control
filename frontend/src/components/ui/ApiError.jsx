import { AlertTriangle, WifiOff } from "lucide-react";
import { describeApiError } from "../../lib/apiError";

// Consistent, compact API-error display. Shows the backend target + request so
// stale-URL/offline issues are obvious, and renders structured `details`
// (e.g. bulk-upsert errors) compactly — first 3 + "+N more".
export default function ApiError({ error, context, title, className = "" }) {
  const d = describeApiError(error, context);
  const Icon = d.isNetwork ? WifiOff : AlertTriangle;
  const shown = d.details.slice(0, 3);
  const extra = d.details.length - shown.length;

  return (
    <div className={`rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-xs text-red-300 ${className}`}>
      <div className="flex items-start gap-2">
        <Icon size={13} className="mt-0.5 shrink-0 text-red-400" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-red-300">{title || d.message}</p>
          {d.hint && <p className="text-red-400/80 mt-0.5">{d.hint}</p>}
          <p className="text-red-400/70 mt-1 font-mono break-all">
            Target: {d.apiBase}
            {d.url ? <>   ·   Request: {d.url}</> : null}
            {`   ·   status ${d.status}`}
          </p>
          {shown.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {shown.map((it, i) => (
                <li key={i} className="break-words">
                  <span className="font-mono text-red-400/70">{it.path || it.entity}</span>
                  {": "}{it.message}
                </li>
              ))}
              {extra > 0 && <li className="text-red-400/70">+{extra} more…</li>}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
