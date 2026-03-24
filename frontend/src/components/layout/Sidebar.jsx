import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, ListTodo, FolderKanban, Brain,
  Bot, CalendarDays, BarChart2, Settings,
  Cpu, FileText, Users, TerminalSquare, Shield, MessageSquarePlus,
  WifiOff, Wifi, Loader, BookKey, Briefcase, Pencil,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { dashboardApi } from "../../api/dashboard";
import NavReorderModal from "./NavReorderModal";

export const NAV_ITEMS = [
  { id: "dashboard",      to: "/",                icon: LayoutDashboard,   label: "Dashboard"        },
  { id: "tasks",          to: "/tasks",           icon: ListTodo,          label: "Tasks"             },
  { id: "projects",       to: "/projects",        icon: FolderKanban,      label: "Projects"          },
  { id: "agents",         to: "/agents",          icon: Bot,               label: "Agents"            },
  { id: "team",           to: "/team",            icon: Users,             label: "Team"              },
  { id: "memory",         to: "/memory",          icon: Brain,             label: "Memory"            },
  { id: "docs",           to: "/docs",            icon: FileText,          label: "Docs"              },
  { id: "models",         to: "/models",          icon: Cpu,               label: "Models"            },
  { id: "terminal",       to: "/terminal",        icon: TerminalSquare,    label: "Terminal"          },
  { id: "calendar",       to: "/calendar",        icon: CalendarDays,      label: "Calendar"          },
  { id: "job-apps",       to: "/job-applications",icon: Briefcase,         label: "Job Apps"          },
  { id: "usage",          to: "/usage",           icon: BarChart2,         label: "Usage"             },
  { id: "security",       to: "/security",        icon: Shield,            label: "Security"          },
  { id: "feedback",       to: "/feedback",        icon: MessageSquarePlus, label: "Feedback"          },
  { id: "ops-notes",      to: "/ops-notes",       icon: BookKey,           label: "Claw Cheatsheet"   },
  { id: "settings",       to: "/settings",        icon: Settings,          label: "Settings"          },
];

function GatewayStatus() {
  const { data, isLoading, isError } = useQuery({
    queryKey:  ["gateway-health"],
    queryFn:   dashboardApi.getGateway,
    refetchInterval: 30_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader size={11} className="text-gray-600 animate-spin" />
        <span className="text-xs text-gray-600">Checking gateway…</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center gap-2" title="Could not reach the Rails backend">
        <WifiOff size={11} className="text-red-500" />
        <span className="text-xs text-red-400">Backend offline</span>
      </div>
    );
  }

  if (data.status === "connected") {
    return (
      <div
        className="flex items-center gap-2"
        title={`Gateway OK · ${data.latency_ms}ms · ${data.gateway_url}`}
      >
        <Wifi size={11} className="text-green-400" />
        <span className="text-xs text-green-400">
          OpenClaw connected
          {data.latency_ms != null && (
            <span className="text-gray-600 ml-1">· {data.latency_ms}ms</span>
          )}
        </span>
      </div>
    );
  }

  // status === "unreachable" (or any other non-connected value)
  return (
    <div
      className="flex items-center gap-2"
      title={data.error || "Gateway did not respond"}
    >
      <WifiOff size={11} className="text-red-500" />
      <span className="text-xs text-red-400">Gateway unreachable</span>
    </div>
  );
}

const NAV_ORDER_STORAGE_KEY = 'crabby_nav_order';

function loadNavOrder() {
  try {
    const saved = localStorage.getItem(NAV_ORDER_STORAGE_KEY);
    if (!saved) return NAV_ITEMS;
    const savedIds = JSON.parse(saved);
    const ordered = savedIds
      .map((id) => NAV_ITEMS.find((item) => item.id === id))
      .filter(Boolean);
    // Append any new items that weren't in the saved order
    const newItems = NAV_ITEMS.filter((item) => !savedIds.includes(item.id));
    return [...ordered, ...newItems];
  } catch {
    return NAV_ITEMS;
  }
}

export default function Sidebar() {
  const [navOrder, setNavOrder] = useState(loadNavOrder);
  const [isReorderOpen, setIsReorderOpen] = useState(false);

  return (
    <aside className="w-56 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🦀</span>
          <div>
            <p className="text-sm font-bold text-white leading-tight">Crabby's</p>
            <p className="text-xs text-gray-400 leading-tight">Mission Control</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navOrder.map(({ id, to, icon: Icon, label }) => (
          <NavLink
            key={id}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-orange-500/20 text-orange-400 font-medium"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Edit Nav button */}
      <div className="px-3 py-2 border-t border-gray-800">
        <button
          onClick={() => setIsReorderOpen(true)}
          className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
        >
          <Pencil size={12} />
          Edit Nav
        </button>
      </div>

      {/* Gateway status — dynamic, polls every 30 s */}
      <div className="px-4 py-3 border-t border-gray-800">
        <GatewayStatus />
      </div>

      {/* Reorder modal */}
      <NavReorderModal
        open={isReorderOpen}
        items={navOrder}
        onSave={(newOrder) => {
          setNavOrder(newOrder);
          localStorage.setItem(NAV_ORDER_STORAGE_KEY, JSON.stringify(newOrder.map((i) => i.id)));
          setIsReorderOpen(false);
        }}
        onCancel={() => setIsReorderOpen(false)}
        defaultItems={NAV_ITEMS}
      />
    </aside>
  );
}
