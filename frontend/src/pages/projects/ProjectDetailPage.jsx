import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  Brain,
  Activity,
  Edit2,
  X,
  Plus,
  Loader2,
  FolderKanban,
  Circle,
  AlertCircle,
} from "lucide-react";
import { projectsApi } from "../../api/projects";
import { tasksApi } from "../../api/tasks";
import { documentsApi } from "../../api/documents";
import { memoriesApi } from "../../api/memories";
import { useChannel } from "../../hooks/useChannel";
import { cn } from "../../lib/utils";

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  active:    "bg-green-500/20 text-green-400 border-green-500/30",
  paused:    "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  archived:  "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const TASK_STATUS_META = {
  backlog:     { label: "Backlog",     dot: "bg-gray-500",   text: "text-gray-400"   },
  in_progress: { label: "In Progress", dot: "bg-blue-500",   text: "text-blue-400"   },
  review:      { label: "Review",      dot: "bg-yellow-500", text: "text-yellow-400" },
  done:        { label: "Done",        dot: "bg-green-500",  text: "text-green-400"  },
};

const PRIORITY_COLORS = {
  urgent: "bg-red-500/20 text-red-400 border-red-500/30",
  high:   "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low:    "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const COLOR_SWATCHES = [
  "#f97316", "#ef4444", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
];

const TABS = [
  { id: "tasks",     label: "Tasks",     icon: FolderKanban },
  { id: "activity",  label: "Activity",  icon: Activity },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "memory",    label: "Memory",    icon: Brain },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60)   return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)   return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)     return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30)      return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getAssignee(id) {
  const map = {
    jose:   { letter: "J", color: "bg-blue-600",   label: "Jose"   },
    crabby: { letter: "C", color: "bg-orange-500",  label: "Crabby" },
  };
  const lower = id?.toLowerCase();
  return map[lower] || { letter: id?.[0]?.toUpperCase() || "?", color: "bg-gray-600", label: id };
}

// Normalize tasks response: could be { backlog: [], ... } or an array
function flattenTasks(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Object.values(data).flat();
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("tasks");
  const [editing, setEditing] = useState(false);

  const { data: project, isLoading, isError } = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectsApi.get(id),
  });

  const { data: summary } = useQuery({
    queryKey: ["project-summary", id],
    queryFn: () => projectsApi.getSummary(id),
    enabled: !!project,
  });

  // Subscribe to project-scoped updates channel to keep task list, summary, and activity fresh
  useChannel(
    id ? { channel: "ProjectUpdatesChannel", project_id: id } : null,
    () => {
      qc.invalidateQueries({ queryKey: ["project-summary", id] });
      qc.invalidateQueries({ queryKey: ["tasks", { project_id: id }] });
      qc.invalidateQueries({ queryKey: ["project-activity", id] });
    },
    [id]
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-6">
          <ArrowLeft size={14} />
          <span>Back to Projects</span>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-800 rounded w-1/3" />
          <div className="h-4 bg-gray-800 rounded w-2/3" />
          <div className="h-32 bg-gray-800 rounded" />
        </div>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="p-6">
        <Link
          to="/projects"
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          Back to Projects
        </Link>
        <p className="text-red-400 text-sm">Project not found.</p>
      </div>
    );
  }

  const statusClass = STATUS_COLORS[project.status] || STATUS_COLORS.active;
  const completion = summary?.completion_percentage ?? 0;
  const totalTasks = summary?.total_tasks ?? 0;
  const doneTasks = summary?.tasks_by_status?.done ?? 0;

  return (
    <div className="p-6">
      {/* Back link */}
      <Link
        to="/projects"
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-4"
      >
        <ArrowLeft size={14} />
        Back to Projects
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <span
          className="w-4 h-4 rounded-full shrink-0"
          style={{ backgroundColor: project.color || "#f97316" }}
        />
        <h1 className="text-2xl font-bold text-white">{project.name}</h1>
        <span className={cn("text-xs border rounded px-1.5 py-0.5", statusClass)}>
          {project.status}
        </span>
        <button
          onClick={() => setEditing(true)}
          className="ml-auto text-gray-500 hover:text-white transition-colors"
        >
          <Edit2 size={16} />
        </button>
      </div>

      {project.description && (
        <p className="text-gray-400 text-sm mt-1 mb-4 ml-7">{project.description}</p>
      )}

      {/* Edit form overlay */}
      {editing && (
        <EditProjectForm
          project={project}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            qc.invalidateQueries({ queryKey: ["project", id] });
            qc.invalidateQueries({ queryKey: ["projects"] });
          }}
        />
      )}

      {/* Progress bar */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mt-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-white font-medium">
            {doneTasks} of {totalTasks} tasks complete ({Math.round(completion)}%)
          </span>
        </div>
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-orange-500 rounded-full transition-all"
            style={{ width: `${completion}%` }}
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(TASK_STATUS_META).map(([key, meta]) => {
            const count = summary?.tasks_by_status?.[key] ?? 0;
            return (
              <span key={key} className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className={cn("w-2 h-2 rounded-full", meta.dot)} />
                {meta.label}: {count}
              </span>
            );
          })}
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-700 flex gap-6 mb-6">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 pb-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                isActive
                  ? "border-orange-500 text-white"
                  : "border-transparent text-gray-400 hover:text-white"
              )}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "tasks" && <TasksTab projectId={id} />}
      {activeTab === "activity" && <ActivityTab projectId={id} />}
      {activeTab === "documents" && <DocumentsTab projectId={id} />}
      {activeTab === "memory" && <MemoryTab projectId={id} />}
    </div>
  );
}

// ── Edit Project Form ────────────────────────────────────────────────────────

function EditProjectForm({ project, onClose, onSaved }) {
  const [name, setName] = useState(project.name || "");
  const [description, setDescription] = useState(project.description || "");
  const [color, setColor] = useState(project.color || COLOR_SWATCHES[0]);
  const [status, setStatus] = useState(project.status || "active");
  const [error, setError] = useState(null);

  const updateMutation = useMutation({
    mutationFn: (data) => projectsApi.update(project.id, data),
    onSuccess: () => onSaved(),
    onError: (err) => {
      setError(err?.response?.data?.error || err.message || "Failed to update project");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateMutation.mutate({
      name: name.trim(),
      description: description.trim() || null,
      color,
      status,
    });
  };

  return (
    <div className="mb-6 bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">Edit Project</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 bg-red-950/50 border border-red-800 rounded px-3 py-2">
          <p className="text-xs text-red-400 flex-1">{error}</p>
          <button onClick={() => setError(null)}>
            <X size={11} className="text-red-500" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name (required)"
          required
          autoFocus
          className="w-full bg-gray-900 text-white text-sm rounded px-2.5 py-1.5 outline-none placeholder-gray-600 border border-gray-700 focus:border-orange-500/50"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full bg-gray-900 text-white text-xs rounded px-2.5 py-1.5 outline-none placeholder-gray-600 border border-gray-700 focus:border-orange-500/50 resize-none"
        />

        {/* Color picker */}
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Color</label>
          <div className="flex items-center gap-2">
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition-all",
                  color === c
                    ? "border-white scale-110"
                    : "border-transparent hover:border-gray-500"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Status */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full bg-gray-900 text-white text-xs rounded px-2 py-1.5 border border-gray-700 outline-none"
        >
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={!name.trim() || updateMutation.isPending}
            className="text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
          >
            {updateMutation.isPending && <Loader2 size={11} className="animate-spin" />}
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
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

// ── Tasks Tab ────────────────────────────────────────────────────────────────

function TasksTab({ projectId }) {
  const qc = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState(null);

  const { data: tasksData, isLoading, isError } = useQuery({
    queryKey: ["tasks", { project_id: projectId }],
    queryFn: () => tasksApi.getAll({ project_id: projectId }),
  });

  const createMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", { project_id: projectId }] });
      qc.invalidateQueries({ queryKey: ["project-summary", projectId] });
      setShowAddForm(false);
      setError(null);
    },
    onError: (err) => {
      setError(err?.response?.data?.error || err.message || "Failed to create task");
    },
  });

  if (isLoading) {
    return <div className="text-gray-400 text-sm">Loading tasks...</div>;
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-red-400 text-sm">
        <AlertCircle size={14} />
        Failed to load tasks.
      </div>
    );
  }

  const tasks = flattenTasks(tasksData);

  return (
    <div>
      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-950/50 border border-red-800 rounded-lg px-4 py-2.5">
          <p className="text-sm text-red-400 flex-1">{error}</p>
          <button onClick={() => setError(null)}>
            <X size={13} className="text-red-500" />
          </button>
        </div>
      )}

      {/* Add task button */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-400">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</span>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={14} />
          Add Task
        </button>
      </div>

      {/* Add task form */}
      {showAddForm && (
        <AddTaskForm
          projectId={projectId}
          onSave={(data) => createMutation.mutate(data)}
          onCancel={() => { setShowAddForm(false); setError(null); }}
          saving={createMutation.isPending}
        />
      )}

      {/* Task list */}
      {tasks.length === 0 && !showAddForm && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <FolderKanban size={40} className="mb-3 text-gray-600" />
          <p className="text-sm font-medium text-gray-400">No tasks yet for this project</p>
          <p className="text-xs mt-1">Click "Add Task" to create one.</p>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task }) {
  const statusMeta = TASK_STATUS_META[task.status] || TASK_STATUS_META.backlog;
  const assignee = task.assignee ? getAssignee(task.assignee) : null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 flex items-center gap-3 hover:border-gray-600 transition-colors">
      {/* Status dot */}
      <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", statusMeta.dot)} />

      {/* Priority badge */}
      {task.priority && (
        <span className={cn("text-xs border rounded px-1.5 py-0.5 shrink-0", PRIORITY_COLORS[task.priority])}>
          {task.priority}
        </span>
      )}

      {/* Title */}
      <span className="text-sm text-white flex-1 truncate">{task.title}</span>

      {/* Assignee */}
      {assignee && (
        <div
          className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center text-white font-bold shrink-0",
            assignee.color
          )}
          style={{ fontSize: "9px" }}
          title={assignee.label}
        >
          {assignee.letter}
        </div>
      )}
    </div>
  );
}

function AddTaskForm({ projectId, onSave, onCancel, saving }) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("backlog");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      assignee: assignee || null,
      priority,
      status,
      project_id: projectId,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 border border-orange-500/50 rounded-lg p-4 mb-4 space-y-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title (required)"
        required
        autoFocus
        className="w-full bg-gray-900 text-white text-sm rounded px-2.5 py-1.5 outline-none placeholder-gray-600 border border-gray-700 focus:border-orange-500/50"
      />
      <div className="flex gap-2">
        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="flex-1 bg-gray-900 text-white text-xs rounded px-2 py-1.5 border border-gray-700 outline-none"
        >
          <option value="">Unassigned</option>
          <option value="jose">Jose</option>
          <option value="crabby">Crabby</option>
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="flex-1 bg-gray-900 text-white text-xs rounded px-2 py-1.5 border border-gray-700 outline-none"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="flex-1 bg-gray-900 text-white text-xs rounded px-2 py-1.5 border border-gray-700 outline-none"
        >
          <option value="backlog">Backlog</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={!title.trim() || saving}
          className="text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
        >
          {saving && <Loader2 size={11} className="animate-spin" />}
          {saving ? "Adding..." : "Add Task"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-gray-500 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Activity Tab ─────────────────────────────────────────────────────────────

function ActivityTab({ projectId }) {
  const { data: activities, isLoading, isError } = useQuery({
    queryKey: ["project-activity", projectId],
    queryFn: () => projectsApi.getActivity(projectId),
  });

  if (isLoading) {
    return <div className="text-gray-400 text-sm">Loading activity...</div>;
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-red-400 text-sm">
        <AlertCircle size={14} />
        Failed to load activity.
      </div>
    );
  }

  const events = activities?.events ?? [];

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <Activity size={40} className="mb-3 text-gray-600" />
        <p className="text-sm font-medium text-gray-400">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {events.map((event, i) => (
        <ActivityRow key={event.id || i} event={event} />
      ))}
    </div>
  );
}

function ActivityRow({ event }) {
  const iconMap = {
    task_created:   <Plus size={14} className="text-green-400" />,
    task_completed: <CheckCircle size={14} className="text-green-400" />,
    task_moved:     <FolderKanban size={14} className="text-blue-400" />,
    task_updated:   <Edit2 size={14} className="text-yellow-400" />,
    project_updated:<Edit2 size={14} className="text-orange-400" />,
    default:        <Circle size={14} className="text-gray-500" />,
  };

  const icon = iconMap[event.event_type] || iconMap[event.action] || iconMap.default;

  return (
    <div className="flex items-start gap-3 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">{event.message || event.description || event.event_type || "Activity"}</p>
        {event.details && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{event.details}</p>
        )}
      </div>
      <span className="text-xs text-gray-500 shrink-0">
        {relativeTime(event.created_at || event.timestamp)}
      </span>
    </div>
  );
}

// ── Documents Tab ────────────────────────────────────────────────────────────

function DocumentsTab({ projectId }) {
  const { data: documents, isLoading, isError } = useQuery({
    queryKey: ["documents", { project_id: projectId }],
    queryFn: () => documentsApi.getAll({ project_id: projectId }),
  });

  if (isLoading) {
    return <div className="text-gray-400 text-sm">Loading documents...</div>;
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-red-400 text-sm">
        <AlertCircle size={14} />
        Failed to load documents.
      </div>
    );
  }

  const docs = documents?.database ?? [];

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <FileText size={40} className="mb-3 text-gray-600" />
        <p className="text-sm font-medium text-gray-400">No documents linked to this project</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {docs.map((doc, i) => (
        <div
          key={doc.id || doc.path || i}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 flex items-center gap-3 hover:border-gray-600 transition-colors"
        >
          <FileText size={16} className="text-gray-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{doc.filename || doc.title || doc.path || "Untitled"}</p>
            {doc.content_type && (
              <p className="text-xs text-gray-500 mt-0.5">{doc.content_type}</p>
            )}
          </div>
          <span className="text-xs text-gray-500 shrink-0">
            {relativeTime(doc.updated_at || doc.created_at)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Memory Tab ───────────────────────────────────────────────────────────────

function MemoryTab({ projectId }) {
  const { data: memories, isLoading, isError } = useQuery({
    queryKey: ["memories", { project_id: projectId }],
    queryFn: () => memoriesApi.getAll({ project_id: projectId }),
  });

  if (isLoading) {
    return <div className="text-gray-400 text-sm">Loading memories...</div>;
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-red-400 text-sm">
        <AlertCircle size={14} />
        Failed to load memories.
      </div>
    );
  }

  const items = memories?.memories ?? [];

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <Brain size={40} className="mb-3 text-gray-600" />
        <p className="text-sm font-medium text-gray-400">No memories linked to this project</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((memory, i) => (
        <div
          key={memory.id || i}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 hover:border-gray-600 transition-colors"
        >
          <div className="flex items-start gap-3">
            <Brain size={14} className="text-purple-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white line-clamp-2">
                {memory.content || memory.text || memory.summary || "Memory entry"}
              </p>
              <div className="flex items-center gap-3 mt-1.5">
                {memory.memory_type && (
                  <span className="text-xs text-gray-500">{memory.memory_type}</span>
                )}
                <span className="text-xs text-gray-500">
                  {relativeTime(memory.created_at || memory.updated_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
