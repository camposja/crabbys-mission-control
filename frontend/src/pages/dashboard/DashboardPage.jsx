import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Zap, AlertCircle, CheckCircle, Clock } from "lucide-react";
import client from "../../api/client";
import { useChannel } from "../../hooks/useChannel";
import { cn } from "../../lib/utils";

export default function DashboardPage() {
  const [events, setEvents] = useState([]);

  const { data: health, isLoading } = useQuery({
    queryKey: ["health"],
    queryFn: () => client.get("/health").then(r => r.data),
    refetchInterval: 15_000,
  });

  const { data: tasks } = useQuery({
    queryKey: ["tasks-summary"],
    queryFn: () => client.get("/tasks").then(r => r.data),
    refetchInterval: 30_000,
  });

  const { data: mission } = useQuery({
    queryKey: ["mission-statement"],
    queryFn: () => client.get("/mission_statement").then(r => r.data),
  });

  // Live agent event feed via Action Cable
  useChannel("AgentEventsChannel", (data) => {
    setEvents(prev => [{ ...data, id: Date.now() }, ...prev].slice(0, 50));
  });

  const taskCounts = {
    backlog:     tasks?.backlog?.length     ?? 0,
    in_progress: tasks?.in_progress?.length ?? 0,
    review:      tasks?.review?.length      ?? 0,
    done:        tasks?.done?.length        ?? 0,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Mission Statement */}
      {mission?.content && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-5 py-4">
          <p className="text-xs text-orange-400 uppercase tracking-widest mb-1 font-medium">North Star</p>
          <p className="text-white text-sm leading-relaxed">{mission.content}</p>
        </div>
      )}

      {/* Status grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          label="OpenClaw"
          value={isLoading ? "…" : health?.openclaw_gateway}
          ok={health?.openclaw_gateway === "connected"}
        />
        <StatusCard label="Backlog"     value={taskCounts.backlog}     ok />
        <StatusCard label="In Progress" value={taskCounts.in_progress} ok />
        <StatusCard label="Done"        value={taskCounts.done}        ok />
      </div>

      {/* Live event feed */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <h2 className="text-sm font-semibold text-white">Live Event Feed</h2>
        </div>
        <div className="divide-y divide-gray-800 max-h-72 overflow-y-auto">
          {events.length === 0 ? (
            <p className="px-4 py-6 text-center text-gray-500 text-sm">
              Waiting for agent activity…
            </p>
          ) : (
            events.map(ev => (
              <div key={ev.id} className="px-4 py-2.5 flex items-start gap-3">
                <Zap size={12} className="text-orange-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-white">{ev.event || ev.type}</p>
                  {ev.message && <p className="text-xs text-gray-500 mt-0.5">{ev.message}</p>}
                </div>
                <span className="ml-auto text-xs text-gray-600 shrink-0">
                  {new Date(ev.id).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatusCard({ label, value, ok }) {
  const Icon = ok ? CheckCircle : AlertCircle;
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <Icon size={14} className={cn(ok ? "text-green-400" : "text-red-400")} />
        <p className="text-lg font-semibold text-white">{value ?? "—"}</p>
      </div>
    </div>
  );
}
