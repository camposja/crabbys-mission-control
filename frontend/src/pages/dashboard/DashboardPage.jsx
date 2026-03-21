import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { dashboardApi } from "../../api/dashboard";
import { useChannel } from "../../hooks/useChannel";
import ErrorBoundary from "../../components/ui/ErrorBoundary";
import MissionStatement from "../../components/dashboard/MissionStatement";
import StatsGrid from "../../components/dashboard/StatsGrid";
import GatewayHealth from "../../components/dashboard/GatewayHealth";
import EventFeed from "../../components/dashboard/EventFeed";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState(null);

  const { data: stats } = useQuery({
    queryKey:        ["stats"],
    queryFn:         dashboardApi.getStats,
    refetchInterval: 15_000,
  });

  const { data: mission } = useQuery({
    queryKey: ["mission-statement"],
    queryFn:  dashboardApi.getMissionStatement,
  });

  const { data: upcoming = [] } = useQuery({
    queryKey:        ["calendar-upcoming"],
    queryFn:         () => dashboardApi.getUpcoming(5),
    refetchInterval: 60_000,
  });

  // Pull system metrics from Action Cable
  useChannel("SystemMetricsChannel", (data) => {
    if (data.type === "metrics" || data.cpu !== undefined) {
      setMetrics(data);
    }
  });

  return (
    <div className="p-6 space-y-5">

      {/* Mission Statement — editable */}
      <ErrorBoundary name="Mission Statement">
        <MissionStatement content={mission?.content} />
      </ErrorBoundary>

      {/* Gateway health bar */}
      <ErrorBoundary name="Gateway Health">
        <GatewayHealth />
      </ErrorBoundary>

      {/* Stats grid */}
      <ErrorBoundary name="Stats">
        <StatsGrid stats={stats} metrics={metrics} />
      </ErrorBoundary>

      {/* Main content: feed + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Event feed — takes 2/3 width */}
        <div className="lg:col-span-2">
          <ErrorBoundary name="Event Feed">
            <EventFeed />
          </ErrorBoundary>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">

          {/* Upcoming events */}
          <ErrorBoundary name="Upcoming Events">
            <div className="bg-gray-900 border border-gray-800 rounded-lg">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
                <CalendarDays size={13} className="text-purple-400" />
                <h2 className="text-sm font-semibold text-white">Upcoming</h2>
              </div>
              <div className="divide-y divide-gray-800">
                {upcoming.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-gray-600 text-center">No upcoming events</p>
                ) : (
                  upcoming.map(ev => (
                    <div key={ev.id} className="px-4 py-2.5">
                      <p className="text-sm text-white">{ev.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(ev.starts_at).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </ErrorBoundary>

          {/* Task summary */}
          <ErrorBoundary name="Task Summary">
            <div className="bg-gray-900 border border-gray-800 rounded-lg">
              <div className="px-4 py-3 border-b border-gray-800">
                <h2 className="text-sm font-semibold text-white">Task Summary</h2>
              </div>
              <div className="p-4 space-y-2">
                {[
                  { label: "Backlog",     count: stats?.tasks?.backlog,     color: "bg-gray-500"   },
                  { label: "In Progress", count: stats?.tasks?.in_progress, color: "bg-blue-500"   },
                  { label: "Review",      count: stats?.tasks?.review,      color: "bg-yellow-500" },
                  { label: "Done",        count: stats?.tasks?.done,        color: "bg-green-500"  },
                ].map(({ label, count, color }) => {
                  const total = stats?.tasks?.total || 1;
                  const pct   = Math.round(((count || 0) / total) * 100);
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">{label}</span>
                        <span className="text-white">{count ?? 0}</span>
                      </div>
                      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
