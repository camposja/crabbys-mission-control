import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, FolderOpen, Loader2 } from "lucide-react";
import { projectsApi } from "../../api/projects";
import { useChannel } from "../../hooks/useChannel";
import { cn } from "../../lib/utils";

const STATUS_COLORS = {
  active:    "bg-green-500/20 text-green-400 border-green-500/30",
  paused:    "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  archived:  "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const COLOR_SWATCHES = [
  "#f97316", "#ef4444", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
];

export default function ProjectsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.getAll,
  });

  // Subscribe to task updates so project list progress bars refresh automatically
  useChannel("TaskUpdatesChannel", () => {
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["project-summary"] });
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white mb-1">Projects</h1>
        <p className="text-gray-400 text-sm mb-6">Manage your projects</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-2/3 mb-3" />
              <div className="h-3 bg-gray-700 rounded w-full mb-2" />
              <div className="h-3 bg-gray-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={14} />
          New Project
        </button>
      </div>

      {/* New project form */}
      {showForm && (
        <NewProjectForm
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ["projects"] });
          }}
        />
      )}

      {/* Empty state */}
      {projects.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <FolderOpen size={48} className="mb-4 text-gray-600" />
          <p className="text-lg font-medium text-gray-400">No projects yet</p>
          <p className="text-sm mt-1">Create your first project to get started.</p>
        </div>
      )}

      {/* Project grid */}
      {projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => navigate(`/projects/${project.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Project Card ──────────────────────────────────────────────────────────────

function ProjectCard({ project, onClick }) {
  const { data: summary } = useQuery({
    queryKey: ["project-summary", project.id],
    queryFn: () => projectsApi.getSummary(project.id),
  });

  const statusClass = STATUS_COLORS[project.status] || STATUS_COLORS.active;
  const completion = summary?.completion_percentage ?? 0;
  const totalTasks = summary?.total_tasks ?? 0;
  const doneTasks = summary?.tasks_by_status?.done ?? 0;

  return (
    <button
      onClick={onClick}
      className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-left hover:border-gray-600 transition-colors w-full"
    >
      {/* Color stripe + name */}
      <div className="flex items-center gap-3 mb-2">
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: project.color || "#f97316" }}
        />
        <span className="text-white font-semibold text-sm truncate">{project.name}</span>
        <span className={cn("ml-auto text-xs border rounded px-1.5 py-0.5 shrink-0", statusClass)}>
          {project.status}
        </span>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-3">
          {project.description}
        </p>
      )}

      {/* Progress bar */}
      <div className="mt-auto">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">
            {doneTasks} done / {totalTasks} total
          </span>
          <span className="text-xs text-gray-500">{Math.round(completion)}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all"
            style={{ width: `${completion}%` }}
          />
        </div>
      </div>
    </button>
  );
}

// ── New Project Form ──────────────────────────────────────────────────────────

// Known Telegram threads in Claw 🦀 Krusty Restaurant
const TELEGRAM_THREADS = [
  { id: "",    label: "None" },
  { id: "1",   label: "General" },
  { id: "2",   label: "Learn Italian" },
  { id: "3",   label: "Job search" },
  { id: "282", label: "Saas business" },
  { id: "287", label: "Money ideas" },
];

function NewProjectForm({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLOR_SWATCHES[0]);
  const [status, setStatus] = useState("active");
  const [telegramThreadId, setTelegramThreadId] = useState("");
  const [error, setError] = useState(null);

  const selectedThread = TELEGRAM_THREADS.find(t => t.id === telegramThreadId);

  const createMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => onCreated(),
    onError: (err) => {
      setError(err?.response?.data?.error || err.message || "Failed to create project");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || null,
      color,
      status,
      telegram_thread_id: telegramThreadId || null,
      telegram_thread_name: selectedThread?.label || null,
    });
  };

  return (
    <div className="mb-6 bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">New Project</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 bg-red-950/50 border border-red-800 rounded px-3 py-2">
          <p className="text-xs text-red-400 flex-1">{error}</p>
          <button onClick={() => setError(null)}><X size={11} className="text-red-500" /></button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Project name (required)"
          required
          autoFocus
          className="w-full bg-gray-900 text-white text-sm rounded px-2.5 py-1.5 outline-none placeholder-gray-600 border border-gray-700 focus:border-orange-500/50"
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full bg-gray-900 text-white text-xs rounded px-2.5 py-1.5 outline-none placeholder-gray-600 border border-gray-700 focus:border-orange-500/50 resize-none"
        />

        {/* Color picker */}
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Color</label>
          <div className="flex items-center gap-2">
            {COLOR_SWATCHES.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition-all",
                  color === c ? "border-white scale-110" : "border-transparent hover:border-gray-500"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Status */}
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="w-full bg-gray-900 text-white text-xs rounded px-2 py-1.5 border border-gray-700 outline-none"
        >
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>

        {/* Telegram Thread */}
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Telegram Thread</label>
          <select
            value={telegramThreadId}
            onChange={e => setTelegramThreadId(e.target.value)}
            className="w-full bg-gray-900 text-white text-xs rounded px-2 py-1.5 border border-gray-700 outline-none"
          >
            {TELEGRAM_THREADS.map(t => (
              <option key={t.id} value={t.id}>{t.label}{t.id ? ` (thread:${t.id})` : ""}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={!name.trim() || createMutation.isPending}
            className="text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
          >
            {createMutation.isPending && <Loader2 size={11} className="animate-spin" />}
            {createMutation.isPending ? "Creating..." : "Create Project"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
