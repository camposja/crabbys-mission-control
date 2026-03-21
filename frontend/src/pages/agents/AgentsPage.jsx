import { useQuery } from "@tanstack/react-query";
import { openclawApi } from "../../api/openclaw";
import { useChannel } from "../../hooks/useChannel";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Circle } from "lucide-react";

export default function AgentsPage() {
  const qc = useQueryClient();

  const { data: agents, isLoading, isError } = useQuery({
    queryKey: ["agents"],
    queryFn:  openclawApi.getAgents,
    retry: 1,
  });

  useChannel("AgentEventsChannel", () => {
    qc.invalidateQueries({ queryKey: ["agents"] });
  });

  if (isLoading) return <div className="p-6 text-gray-400 text-sm">Loading agents…</div>;

  if (isError) return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-2">Agents</h1>
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-sm text-yellow-400">
        Could not reach OpenClaw gateway. Make sure OPENCLAW_GATEWAY_TOKEN is set and the gateway is running on port 18789.
      </div>
    </div>
  );

  const list = Array.isArray(agents) ? agents : (agents?.agents || agents?.data || []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-1">Agents</h1>
      <p className="text-gray-400 text-sm mb-6">{list.length} agent{list.length !== 1 ? "s" : ""} in hierarchy</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((agent, i) => (
          <div key={agent.id || i} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                <Bot size={18} className="text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{agent.name || agent.id}</p>
                <p className="text-xs text-gray-500">{agent.model || "unknown model"}</p>
              </div>
              <Circle
                size={8}
                className={`ml-auto ${agent.status === "active" ? "text-green-400 fill-green-400" : "text-gray-600 fill-gray-600"}`}
              />
            </div>
            {agent.description && (
              <p className="text-xs text-gray-500 line-clamp-2">{agent.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
