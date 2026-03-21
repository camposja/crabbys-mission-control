import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import ErrorBoundary from "../ui/ErrorBoundary";

// Map path → panel name for error boundary labels
const panelName = (path) => {
  const map = {
    "/":          "Dashboard",
    "/tasks":     "Tasks",
    "/projects":  "Projects",
    "/agents":    "Agents",
    "/memory":    "Memory",
    "/calendar":  "Calendar",
    "/usage":     "Usage",
    "/settings":  "Settings",
  };
  return map[path] || "Panel";
};

export default function AppLayout() {
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <ErrorBoundary key={location.pathname} name={panelName(location.pathname)}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
