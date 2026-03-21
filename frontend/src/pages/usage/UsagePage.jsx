import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  DollarSign, Cpu, ArrowDown, ArrowUp, AlertTriangle,
  CheckCircle2, XCircle, AlertCircle, RefreshCw, Settings,
  Check, X, Bell, BellOff, Activity,
} from "lucide-react";
import { usageApi } from "../../api/usage";
import { useChannel } from "../../hooks/useChannel";
import ErrorBoundary from "../../components/ui/ErrorBoundary";

// ── Palette ───────────────────────────────────────────────────────────────────
const CHART_COLORS = ["#f97316", "#3b82f6", "#a855f7", "#22c55e", "#ec4899", "#facc15"];
const SEV_CONFIG = {
  ok:       { icon: CheckCircle2, color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20" },
  warning:  { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  critical: { icon: XCircle,      color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={color} />
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Threshold editor ──────────────────────────────────────────────────────────
function ThresholdEditor({ thresholds, onClose }) {
  const qc = useQueryClient();
  const [daily,   setDaily]   = useState(thresholds?.daily_cost_usd   ?? 5);
  const [hourly,  setHourly]  = useState(thresholds?.hourly_tokens    ?? 500000);
  const [monthly, setMonthly] = useState(thresholds?.monthly_cost_usd ?? 50);

  const save = useMutation({
    mutationFn: () => usageApi.updateThresholds({
      daily_cost_usd:   parseFloat(daily),
      hourly_tokens:    parseInt(hourly),
      monthly_cost_usd: parseFloat(monthly),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["thresholds"] });
      onClose();
    },
  });

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
      <p className="text-sm font-semibold text-white flex items-center gap-2">
        <Bell size={14} className="text-orange-400" /> Alert Thresholds
      </p>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Daily cost ($)", value: daily, set: setDaily, prefix: "$" },
          { label: "Hourly tokens", value: hourly, set: setHourly, prefix: "" },
          { label: "Monthly cost ($)", value: monthly, set: setMonthly, prefix: "$" },
        ].map(({ label, value, set }) => (
          <div key={label}>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <input
              type="number"
              value={value}
              onChange={e => set(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white outline-none focus:border-orange-500/50"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="flex items-center gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-1.5 rounded transition-colors"
        >
          <Check size={11} /> {save.isPending ? "Saving…" : "Save"}
        </button>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-white px-2 py-1.5 transition-colors">
          <X size={11} />
        </button>
      </div>
    </div>
  );
}

// ── Usage Spike Banner ────────────────────────────────────────────────────────
function SpikeBanner({ spike, onDismiss }) {
  if (!spike) return null;
  return (
    <div className="flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} className="text-red-400 shrink-0" />
        <p className="text-sm text-red-300">{spike.message}</p>
      </div>
      <button onClick={onDismiss} className="text-red-400/60 hover:text-red-400 transition-colors ml-3">
        <X size={14} />
      </button>
    </div>
  );
}

// ── Usage Tab ─────────────────────────────────────────────────────────────────
function UsageTab() {
  const qc = useQueryClient();
  const [days, setDays]           = useState(30);
  const [showThresholds, setShow] = useState(false);
  const [spike, setSpike]         = useState(null);

  const fromDate = new Date(Date.now() - days * 86400_000).toISOString().split("T")[0];

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["usage", days],
    queryFn:  () => usageApi.getAll({ from: fromDate }),
    staleTime: 60_000,
  });

  const { data: timeline, isLoading: loadingTimeline } = useQuery({
    queryKey: ["usage-timeline", days],
    queryFn:  () => usageApi.getTimeline({ from: fromDate }),
    staleTime: 60_000,
  });

  const { data: thresholds } = useQuery({
    queryKey: ["thresholds"],
    queryFn:  usageApi.getThresholds,
    staleTime: 300_000,
  });

  // Listen for usage spikes via EventsChannel
  useChannel("EventsChannel", (msg) => {
    if (msg?.type === "usage_spike" || msg?.event === "usage_spike") {
      setSpike(msg);
    }
  });

  const timelineData = timeline?.timeline || [];
  const byModel      = summary?.by_model  || [];
  const byAgent      = Object.entries(summary?.by_agent || {});

  const pieData = byModel.map((m, i) => ({
    name:  m.model || "unknown",
    value: parseFloat(m.cost) || 0,
    color: CHART_COLORS[i % CHART_COLORS.length],
  })).filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <SpikeBanner spike={spike} onDismiss={() => setSpike(null)} />

      {/* Controls row */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
          {[7, 14, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                days === d ? "bg-gray-700 text-white" : "text-gray-500 hover:text-white"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
        <button
          onClick={() => setShow(v => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-orange-400 transition-colors"
        >
          <Settings size={13} /> Thresholds
        </button>
      </div>

      {showThresholds && (
        <ThresholdEditor thresholds={thresholds} onClose={() => setShow(false)} />
      )}

      {/* Summary cards */}
      {loadingSummary ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={DollarSign} label="Total Cost"    color="text-green-400"
            value={`$${summary?.total_cost ?? 0}`}
            sub={`last ${days} days`}
          />
          <StatCard icon={ArrowDown}  label="Input Tokens"  color="text-blue-400"
            value={fmt(summary?.total_input)}
          />
          <StatCard icon={ArrowUp}    label="Output Tokens" color="text-purple-400"
            value={fmt(summary?.total_output)}
          />
          <StatCard icon={Cpu}        label="Models Used"   color="text-orange-400"
            value={byModel.length}
          />
        </div>
      )}

      {/* Timeline line chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Daily Token Usage</h2>
        {loadingTimeline || timelineData.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-gray-600 text-sm">
            {loadingTimeline ? "Loading…" : "No data for this period"}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={timelineData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="inputGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="outputGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} />
              <YAxis tickFormatter={fmt} tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#9ca3af" }}
                formatter={(v, name) => [fmt(v), name === "input" ? "Input tokens" : "Output tokens"]}
              />
              <Legend formatter={v => v === "input" ? "Input" : "Output"} wrapperStyle={{ fontSize: 12, color: "#9ca3af" }} />
              <Area type="monotone" dataKey="input"  stroke="#3b82f6" strokeWidth={2} fill="url(#inputGrad)"  dot={false} />
              <Area type="monotone" dataKey="output" stroke="#a855f7" strokeWidth={2} fill="url(#outputGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Cost line chart */}
      {timelineData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Daily Cost ($)</h2>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={timelineData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} />
              <YAxis tickFormatter={v => `$${v}`} tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#9ca3af" }}
                formatter={v => [`$${v}`, "Cost"]}
              />
              <Line type="monotone" dataKey="cost" stroke="#f97316" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Model breakdown: pie + table */}
      {byModel.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pie */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Cost by Model</h2>
            {pieData.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-8">No cost data</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
                    formatter={v => [`$${v}`, "Cost"]}
                  />
                  <Legend
                    formatter={(value) => value.length > 20 ? value.slice(0, 18) + "…" : value}
                    wrapperStyle={{ fontSize: 11, color: "#9ca3af" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-white">By Model</h2>
            </div>
            <div className="divide-y divide-gray-800">
              {byModel.map((m, i) => (
                <div key={m.model || i} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <p className="text-xs text-gray-300 font-mono flex-1 truncate">{m.model || "—"}</p>
                  <p className="text-xs text-gray-500">{fmt(m.input)}↓</p>
                  <p className="text-xs text-gray-500">{fmt(m.output)}↑</p>
                  <p className="text-sm text-green-400 font-medium">${m.cost}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* By agent */}
      {byAgent.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">By Agent</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {byAgent.map(([agent, cost]) => (
              <div key={agent} className="px-4 py-3 flex items-center justify-between">
                <p className="text-sm text-white">{agent || "unknown"}</p>
                <p className="text-sm text-green-400 font-medium">${cost}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loadingSummary && byModel.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-600">
          <Activity size={36} className="mb-3 opacity-40" />
          <p className="text-sm">No usage data for this period</p>
          <p className="text-xs mt-1">Usage records are ingested when OpenClaw reports token usage</p>
        </div>
      )}
    </div>
  );
}

// ── Diagnostics Tab ───────────────────────────────────────────────────────────
function DiagnosticsTab() {
  const qc = useQueryClient();
  const [liveMetrics, setLiveMetrics] = useState(null);

  const { data: diag, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["diagnostics"],
    queryFn:  usageApi.getDiagnostics,
    staleTime: 30_000,
    retry: 1,
  });

  const restart = useMutation({
    mutationFn: usageApi.restartGateway,
    onSuccess: () => {
      setTimeout(() => qc.invalidateQueries({ queryKey: ["diagnostics"] }), 2000);
    },
  });

  // Live system metrics via Action Cable
  useChannel("SystemMetricsChannel", (msg) => {
    if (msg?.type === "system_metrics" || msg?.cpu !== undefined) {
      setLiveMetrics(msg);
    }
  });

  function GaugeBar({ label, percent, color }) {
    return (
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{label}</span>
          <span>{percent}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${color}`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Live metrics panel */}
      {liveMetrics && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity size={14} className="text-green-400" /> Live System Metrics
            </h2>
            <span className="text-xs text-gray-600">auto-updating</span>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <GaugeBar
                label="CPU"
                percent={typeof liveMetrics.cpu === "number" ? liveMetrics.cpu : 0}
                color={liveMetrics.cpu > 85 ? "bg-red-500" : liveMetrics.cpu > 65 ? "bg-yellow-500" : "bg-green-500"}
              />
            </div>
            <div>
              <GaugeBar
                label="Memory"
                percent={liveMetrics.memory?.percent ?? 0}
                color={(liveMetrics.memory?.percent ?? 0) > 85 ? "bg-red-500" : (liveMetrics.memory?.percent ?? 0) > 65 ? "bg-yellow-500" : "bg-blue-500"}
              />
              <p className="text-xs text-gray-600 mt-1">
                {liveMetrics.memory?.used_mb}MB / {liveMetrics.memory?.total_mb}MB
              </p>
            </div>
            <div>
              <GaugeBar
                label="Disk"
                percent={liveMetrics.disk?.percent ?? 0}
                color={(liveMetrics.disk?.percent ?? 0) > 85 ? "bg-red-500" : (liveMetrics.disk?.percent ?? 0) > 65 ? "bg-yellow-500" : "bg-purple-500"}
              />
              <p className="text-xs text-gray-600 mt-1">
                {liveMetrics.disk?.available} free
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostic checks */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <CheckCircle2 size={14} className="text-orange-400" /> Health Checks
          </h2>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
            {isFetching ? "Checking…" : "Refresh"}
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 text-gray-500 text-sm">Running diagnostics…</div>
        ) : (
          <>
            {/* Overall banner */}
            {diag && (
              <div className={`px-4 py-2.5 border-b border-gray-800 flex items-center gap-2 text-sm ${
                diag.overall === "critical" ? "bg-red-500/10 text-red-400" :
                diag.overall === "warning"  ? "bg-yellow-500/10 text-yellow-400" :
                "bg-green-500/10 text-green-400"
              }`}>
                {diag.overall === "critical" ? <XCircle size={14} /> :
                 diag.overall === "warning"  ? <AlertTriangle size={14} /> :
                 <CheckCircle2 size={14} />}
                System is {diag.overall === "ok" ? "healthy" : diag.overall}
                {diag.checked_at && (
                  <span className="text-gray-600 text-xs ml-auto">
                    {new Date(diag.checked_at).toLocaleTimeString()}
                  </span>
                )}
              </div>
            )}

            <div className="divide-y divide-gray-800">
              {(diag?.checks || []).map((check, i) => {
                const sev = SEV_CONFIG[check.severity] || SEV_CONFIG.ok;
                const SevIcon = sev.icon;
                return (
                  <div key={check.key || i} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <SevIcon size={14} className={`${sev.color} mt-0.5 shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm text-white font-medium">{check.name}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${sev.bg} ${sev.color}`}>
                            {check.value}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{check.detail}</p>
                        {check.suggestion && (
                          <p className="text-xs text-yellow-400/80 mt-1">{check.suggestion}</p>
                        )}
                        {check.action === "restart_gateway" && (
                          <button
                            onClick={() => restart.mutate()}
                            disabled={restart.isPending}
                            className="mt-2 flex items-center gap-1.5 text-xs bg-orange-500/20 hover:bg-orange-500/30 disabled:opacity-50 text-orange-400 px-2.5 py-1 rounded transition-colors"
                          >
                            <RefreshCw size={11} className={restart.isPending ? "animate-spin" : ""} />
                            {restart.isPending ? "Restarting…" : "Restart Gateway"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function UsageInner() {
  const [tab, setTab] = useState("usage");

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-3">Usage & Health</h1>
        <div className="flex gap-1 bg-gray-800 p-1 rounded-lg w-fit">
          <button
            onClick={() => setTab("usage")}
            className={`flex items-center gap-1.5 text-xs px-4 py-2 rounded-md transition-colors ${
              tab === "usage" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-white"
            }`}
          >
            <DollarSign size={12} /> Usage & Cost
          </button>
          <button
            onClick={() => setTab("diagnostics")}
            className={`flex items-center gap-1.5 text-xs px-4 py-2 rounded-md transition-colors ${
              tab === "diagnostics" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-white"
            }`}
          >
            <Activity size={12} /> Diagnostics
          </button>
        </div>
      </div>

      <div className="px-6 py-6">
        {tab === "usage" ? <UsageTab /> : <DiagnosticsTab />}
      </div>
    </div>
  );
}

export default function UsagePage() {
  return (
    <ErrorBoundary>
      <UsageInner />
    </ErrorBoundary>
  );
}
