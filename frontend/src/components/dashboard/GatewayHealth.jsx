import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../../api/dashboard";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";

export default function GatewayHealth() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey:       ["gateway"],
    queryFn:        dashboardApi.getGateway,
    refetchInterval: 30_000,
    retry:           1,
  });

  const connected = data?.status === "connected";

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-lg border px-4 py-3",
      connected
        ? "bg-green-500/5  border-green-500/20"
        : "bg-red-500/10   border-red-500/30"
    )}>
      <div className={cn("p-1.5 rounded", connected ? "bg-green-500/20" : "bg-red-500/20")}>
        {connected
          ? <Wifi size={14} className="text-green-400" />
          : <WifiOff size={14} className="text-red-400" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white">OpenClaw Gateway</p>
        <p className={cn("text-xs", connected ? "text-green-400" : "text-red-400")}>
          {isLoading
            ? "Checking…"
            : connected
              ? `Connected · ${data.latency_ms}ms · ${data.gateway_url}`
              : `Unreachable · ${data?.gateway_url}`
          }
        </p>
      </div>

      <button
        onClick={() => refetch()}
        disabled={isFetching}
        className="text-gray-600 hover:text-white transition-colors disabled:opacity-50"
        title="Re-check gateway"
      >
        <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
      </button>
    </div>
  );
}
