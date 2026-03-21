import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { securityApi } from "../../api/security";
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, Info,
  RefreshCw, Wifi, WifiOff, Lock, Eye, Terminal, Copy,
} from "lucide-react";
import ErrorBoundary from "../../components/ui/ErrorBoundary";

const SEV = {
  ok:       { icon: CheckCircle2, color: "text-green-400",  bg: "bg-green-500/10  border-green-500/20",  label: "OK"       },
  warning:  { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", label: "Warning"  },
  critical: { icon: XCircle,      color: "text-red-400",    bg: "bg-red-500/10    border-red-500/20",    label: "Critical" },
  info:     { icon: Info,         color: "text-blue-400",   bg: "bg-blue-500/10   border-blue-500/20",   label: "Info"     },
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-gray-600 hover:text-white transition-colors ml-1.5"
      title="Copy command"
    >
      {copied ? <CheckCircle2 size={11} className="text-green-400" /> : <Copy size={11} />}
    </button>
  );
}

function FindingCard({ finding }) {
  const sev     = SEV[finding.severity] || SEV.info;
  const SevIcon = sev.icon;

  return (
    <div className={`border rounded-lg p-4 ${sev.bg}`}>
      <div className="flex items-start gap-3">
        <SevIcon size={14} className={`${sev.color} mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium text-white">{finding.title}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded border ${sev.bg} ${sev.color}`}>
              {sev.label}
            </span>
            {finding.category && (
              <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
                {finding.category}
              </span>
            )}
          </div>
          {finding.detail && (
            <p className="text-xs text-gray-400 mb-1">{finding.detail}</p>
          )}
          {finding.fix && (
            <div className="flex items-center gap-1 mt-2">
              <code className="text-xs bg-gray-950 text-green-400 px-2 py-1 rounded font-mono">
                {finding.fix}
              </code>
              <CopyButton text={finding.fix} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AuditTab() {
  const qc = useQueryClient();

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["security-audit"],
    queryFn:  securityApi.getAudit,
    staleTime: 60_000,
    retry: 1,
  });

  const overall = data?.overall || "ok";
  const cfg     = SEV[overall] || SEV.ok;
  const OverallIcon = cfg.icon;

  return (
    <div className="space-y-5">
      {/* Admin access warning — always visible */}
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Lock size={16} className="text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-300 mb-1">Full Admin Access Warning</p>
            <p className="text-xs text-red-200/80 leading-relaxed">
              Anyone who can reach this app has <strong>full admin access</strong> to your OpenClaw agents,
              your local shell (via Terminal), and all workspace files.{" "}
              <strong>This app must only be accessible from localhost.</strong>{" "}
              Never expose ports 3000 or 18789 to the internet directly.
              Use Tailscale or SSH tunnelling for remote access.
            </p>
          </div>
        </div>
      </div>

      {/* Audit results */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <OverallIcon size={14} className={cfg.color} />
            <h2 className="text-sm font-semibold text-white">Security Audit</h2>
            {data && (
              <span className={`text-xs px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
                {data.critical_count} critical · {data.warning_count} warnings
              </span>
            )}
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
            {isFetching ? "Scanning…" : "Re-scan"}
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 text-gray-500 text-sm">Running security audit…</div>
        ) : (
          <div className="p-4 space-y-3">
            {(data?.findings || []).map((f, i) => (
              <FindingCard key={f.id || i} finding={f} />
            ))}
            {data?.audited_at && (
              <p className="text-xs text-gray-700 text-right pt-1">
                Last scan: {new Date(data.audited_at).toLocaleTimeString()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Permissions viewer */}
      <AgentPermissions />
    </div>
  );
}

function AgentPermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ["security-permissions"],
    queryFn:  securityApi.getPermissions,
    staleTime: 120_000,
  });

  const agents = data?.agents || [];
  if (isLoading) return null;
  if (agents.length === 0) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Eye size={14} className="text-orange-400" /> Agent Permissions
        </h2>
      </div>
      <div className="divide-y divide-gray-800">
        {agents.map((agent, i) => (
          <div key={agent.id || i} className="px-5 py-3 flex items-start gap-3">
            <div>
              <p className="text-sm text-white font-medium">{agent.name}</p>
              <p className="text-xs text-gray-600">{agent.model || "unknown model"}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 ml-auto">
              {agent.permissions?.length > 0 ? (
                agent.permissions.map((perm, j) => (
                  <span
                    key={j}
                    className={`text-xs px-2 py-0.5 rounded border font-mono ${
                      perm === "*" || perm.includes("shell") || perm.includes("exec")
                        ? "text-red-400 bg-red-500/10 border-red-500/20"
                        : "text-gray-400 bg-gray-800 border-gray-700"
                    }`}
                  >
                    {perm}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-600">no explicit permissions listed</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RemoteAccessTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["security-remote"],
    queryFn:  securityApi.getRemoteAccess,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-5">
      {/* Status card */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            {data?.tailscale?.connected ? (
              <Wifi size={16} className="text-green-400" />
            ) : (
              <WifiOff size={16} className="text-gray-600" />
            )}
            <p className="text-sm font-semibold text-white">Tailscale</p>
          </div>
          {isLoading ? (
            <p className="text-gray-600 text-xs">Checking…</p>
          ) : data?.tailscale?.connected ? (
            <>
              <p className="text-xs text-green-400 mb-1">Connected</p>
              {data.tailscale.ip && (
                <p className="text-xs text-gray-400 font-mono">{data.tailscale.ip}</p>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-2">Not active</p>
              <a
                href="https://tailscale.com/download"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-orange-400 hover:underline"
              >
                Install Tailscale →
              </a>
            </>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Terminal size={16} className="text-blue-400" />
            <p className="text-sm font-semibold text-white">SSH Tunnel</p>
          </div>
          <p className="text-xs text-gray-500 mb-2">Forward port 3000 from remote to local:</p>
          <div className="flex items-center gap-1">
            <code className="text-xs bg-gray-950 text-green-400 px-2 py-1 rounded font-mono flex-1 truncate">
              ssh -L 3000:localhost:3000 your-machine
            </code>
            <CopyButton text="ssh -L 3000:localhost:3000 your-machine" />
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Shield size={14} className="text-orange-400" /> Remote Access Best Practices
        </h2>
        <div className="space-y-2.5">
          {(data?.recommendations || [
            "Use Tailscale for secure remote access without opening firewall ports.",
            "Alternatively: ssh -L 3000:localhost:3000 your-machine",
            "NEVER expose port 3000 or 18789 directly on a public interface.",
            "Keep agent memory and intelligence local — only use external services for UI state if needed."
          ]).map((rec, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 size={12} className="text-green-400 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-400">{rec}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SecurityInner() {
  const [tab, setTab] = useState("audit");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 pt-6 pb-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-3">Security</h1>
        <div className="flex gap-1 bg-gray-800 p-1 rounded-lg w-fit">
          <button
            onClick={() => setTab("audit")}
            className={`flex items-center gap-1.5 text-xs px-4 py-2 rounded-md transition-colors ${
              tab === "audit" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-white"
            }`}
          >
            <Shield size={12} /> Audit
          </button>
          <button
            onClick={() => setTab("remote")}
            className={`flex items-center gap-1.5 text-xs px-4 py-2 rounded-md transition-colors ${
              tab === "remote" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-white"
            }`}
          >
            <Wifi size={12} /> Remote Access
          </button>
        </div>
      </div>
      <div className="px-6 py-6">
        {tab === "audit" ? <AuditTab /> : <RemoteAccessTab />}
      </div>
    </div>
  );
}

export default function SecurityPage() {
  return (
    <ErrorBoundary>
      <SecurityInner />
    </ErrorBoundary>
  );
}
