import { AlertTriangle, Info } from "lucide-react";
import { IS_LAN_MODE, IS_REMOTE_HOST, BACKEND_TARGET } from "../../lib/config";

// Persistent safety banner. Two states:
//  - LAN mode active (opened from a remote host AND VITE_ENABLE_LAN_MODE=true):
//    red warning — operator controls are reachable over the network.
//  - Opened from a remote host but LAN mode OFF: amber notice — the app is
//    targeting localhost and won't reach this server; explains how to enable.
// Loopback (the normal case) renders nothing.
export default function LanWarningBanner() {
  if (IS_LAN_MODE) {
    return (
      <div className="bg-red-950/80 border-b border-red-700 text-red-200 px-4 py-2 text-xs flex items-start gap-2">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-400" />
        <p className="leading-snug">
          <span className="font-semibold text-red-300">LAN mode is active.</span>{" "}
          Mission Control exposes local operator controls (terminal, agents, task state) and has no login.
          Use only over a trusted LAN, Tailscale, or SSH tunnel.{" "}
          <span className="text-red-300/80">Backend: {BACKEND_TARGET}</span>
        </p>
      </div>
    );
  }

  if (IS_REMOTE_HOST) {
    return (
      <div className="bg-amber-950/70 border-b border-amber-700 text-amber-200 px-4 py-2 text-xs flex items-start gap-2">
        <Info size={14} className="mt-0.5 shrink-0 text-amber-400" />
        <p className="leading-snug">
          You opened Mission Control over the network, but{" "}
          <span className="font-semibold text-amber-300">LAN mode is off</span> — it is targeting{" "}
          <span className="font-mono">localhost:3000</span> and will not reach this server. To use it over the
          network, set <span className="font-mono">VITE_ENABLE_LAN_MODE=true</span> (frontend) and{" "}
          <span className="font-mono">MISSION_CONTROL_ALLOW_LAN=true</span> (backend), then restart both.
        </p>
      </div>
    );
  }

  return null;
}
