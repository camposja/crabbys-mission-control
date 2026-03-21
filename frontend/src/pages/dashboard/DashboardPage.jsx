import { useQuery } from "@tanstack/react-query";
import client from "../../api/client";

export default function DashboardPage() {
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: () => client.get("/health").then(r => r.data),
    refetchInterval: 30_000,
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
      <p className="text-gray-400 text-sm mb-6">Welcome back. Here's what's happening.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="OpenClaw" value={health?.openclaw_gateway ?? "…"} />
        <StatCard label="Rails" value={health?.rails ?? "…"} />
        <StatCard label="Ruby" value={health?.ruby ?? "…"} />
        <StatCard label="Status" value={health?.status ?? "…"} />
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
