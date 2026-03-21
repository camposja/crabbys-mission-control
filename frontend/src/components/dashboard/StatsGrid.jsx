import { Bot, ListTodo, Clock, FolderKanban, Cpu, HardDrive, MemoryStick } from "lucide-react";
import { cn } from "../../lib/utils";

export default function StatsGrid({ stats, metrics }) {
  const cards = [
    {
      icon:  Bot,
      label: "Agents",
      value: stats?.agents?.total ?? "—",
      sub:   stats?.agents?.online != null ? `${stats.agents.online} online` : null,
      color: "text-blue-400",
      bg:    "bg-blue-500/10",
    },
    {
      icon:  ListTodo,
      label: "In Progress",
      value: stats?.tasks?.in_progress ?? "—",
      sub:   stats?.tasks?.total != null ? `${stats.tasks.total} total tasks` : null,
      color: "text-orange-400",
      bg:    "bg-orange-500/10",
    },
    {
      icon:  FolderKanban,
      label: "Projects",
      value: stats?.projects?.active ?? "—",
      sub:   "active",
      color: "text-purple-400",
      bg:    "bg-purple-500/10",
    },
    {
      icon:  Clock,
      label: "Cron Jobs",
      value: stats?.cron_jobs?.enabled ?? "—",
      sub:   "enabled",
      color: "text-green-400",
      bg:    "bg-green-500/10",
    },
  ];

  const systemCards = metrics ? [
    {
      icon:  Cpu,
      label: "CPU",
      value: `${metrics.cpu ?? 0}%`,
      bar:   metrics.cpu,
      color: metrics.cpu > 80 ? "text-red-400" : "text-cyan-400",
    },
    {
      icon:  MemoryStick,
      label: "RAM",
      value: `${metrics.memory?.percent ?? 0}%`,
      sub:   metrics.memory?.used_mb ? `${metrics.memory.used_mb}MB used` : null,
      bar:   metrics.memory?.percent,
      color: (metrics.memory?.percent ?? 0) > 80 ? "text-red-400" : "text-cyan-400",
    },
    {
      icon:  HardDrive,
      label: "Disk",
      value: `${metrics.disk?.percent ?? 0}%`,
      sub:   metrics.disk?.available ? `${metrics.disk.available} free` : null,
      bar:   metrics.disk?.percent,
      color: (metrics.disk?.percent ?? 0) > 85 ? "text-red-400" : "text-cyan-400",
    },
  ] : [];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(c => (
        <StatCard key={c.label} {...c} />
      ))}
      {systemCards.map(c => (
        <StatCard key={c.label} {...c} />
      ))}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, bg, bar }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("p-1.5 rounded", bg || "bg-gray-800")}>
          <Icon size={13} className={color} />
        </div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      {bar != null && (
        <div className="mt-2 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", bar > 80 ? "bg-red-500" : "bg-cyan-500")}
            style={{ width: `${Math.min(bar, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
