import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppLayout      from "./components/layout/AppLayout";
import DashboardPage  from "./pages/dashboard/DashboardPage";
import TasksPage      from "./pages/tasks/TasksPage";
import ProjectsPage   from "./pages/projects/ProjectsPage";
import AgentsPage     from "./pages/agents/AgentsPage";
import MemoryPage     from "./pages/memory/MemoryPage";
import CalendarPage   from "./pages/calendar/CalendarPage";
import UsagePage      from "./pages/usage/UsagePage";
import SettingsPage   from "./pages/settings/SettingsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index             element={<DashboardPage />} />
            <Route path="tasks"      element={<TasksPage />} />
            <Route path="projects"   element={<ProjectsPage />} />
            <Route path="agents"     element={<AgentsPage />} />
            <Route path="memory"     element={<MemoryPage />} />
            <Route path="calendar"   element={<CalendarPage />} />
            <Route path="usage"      element={<UsagePage />} />
            <Route path="settings"   element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
