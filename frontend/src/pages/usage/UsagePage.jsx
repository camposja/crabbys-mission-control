import { useQuery } from "@tanstack/react-query";
import client from "../../api/client";
import { DollarSign, Cpu, ArrowDown, ArrowUp } from "lucide-react";

export default function UsagePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["usage"],
    queryFn: () => client.get("/usage").then(r => r.data),
    refetchInterval: 60_000,
  });

  if (isLoading) return <div className="p-6 text-gray-400 text-sm">Loading usage data…</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Usage & Cost</h1>
        <p className="text-gray-400 text-sm">Token usage and cost across all models — last 30 days</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Total Cost"    value={`$${data?.total_cost ?? 0}`} color="text-green-400" />
        <StatCard icon={ArrowDown}  label="Input Tokens"  value={fmt(data?.total_input)}  color="text-blue-400" />
        <StatCard icon={ArrowUp}    label="Output Tokens" value={fmt(data?.total_output)} color="text-purple-400" />
        <StatCard icon={Cpu}        label="Models Used"   value={data?.by_model?.length ?? 0} color="text-orange-400" />
      </div>

      {/* By model */}
      {data?.by_model?.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">By Model</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {data.by_model.map(m => (
              <div key={m.model} className="px-4 py-3 flex items-center gap-4">
                <p className="text-sm text-white font-mono flex-1">{m.model}</p>
                <p className="text-xs text-gray-400">{fmt(m.input)} in</p>
                <p className="text-xs text-gray-400">{fmt(m.output)} out</p>
                <p className="text-sm text-green-400 font-medium">${m.cost}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By agent */}
      {data?.by_agent && Object.keys(data.by_agent).length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">By Agent</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {Object.entries(data.by_agent).map(([agent, cost]) => (
              <div key={agent} className="px-4 py-3 flex items-center justify-between">
                <p className="text-sm text-white">{agent}</p>
                <p className="text-sm text-green-400 font-medium">${cost}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={color} />
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function fmt(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
