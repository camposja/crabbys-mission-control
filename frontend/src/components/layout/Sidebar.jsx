import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, ListTodo, FolderKanban, Brain,
  Bot, CalendarDays, BarChart2, Settings, Zap,
  Cpu, FileText, Users,
} from "lucide-react";
import { cn } from "../../lib/utils";

const nav = [
  { to: "/",          icon: LayoutDashboard, label: "Dashboard"  },
  { to: "/tasks",     icon: ListTodo,        label: "Tasks"       },
  { to: "/projects",  icon: FolderKanban,    label: "Projects"    },
  { to: "/agents",    icon: Bot,             label: "Agents"      },
  { to: "/team",      icon: Users,           label: "Team"        },
  { to: "/memory",    icon: Brain,           label: "Memory"      },
  { to: "/docs",      icon: FileText,        label: "Docs"        },
  { to: "/models",    icon: Cpu,             label: "Models"      },
  { to: "/calendar",  icon: CalendarDays,    label: "Calendar"    },
  { to: "/usage",     icon: BarChart2,       label: "Usage"       },
  { to: "/settings",  icon: Settings,        label: "Settings"    },
];

export default function Sidebar() {
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
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
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

      {/* Gateway status */}
      <div className="px-4 py-3 border-t border-gray-800">
        <div className="flex items-center gap-2">
          <Zap size={12} className="text-green-400" />
          <span className="text-xs text-gray-500">OpenClaw connected</span>
        </div>
      </div>
    </aside>
  );
}
