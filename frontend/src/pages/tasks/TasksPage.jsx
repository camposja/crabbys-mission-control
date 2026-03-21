import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { Plus, GripVertical, X } from "lucide-react";
import { tasksApi } from "../../api/tasks";
import { useChannel } from "../../hooks/useChannel";
import { cn } from "../../lib/utils";

const COLUMNS = [
  { id: "backlog",     label: "Backlog",     color: "text-gray-400"   },
  { id: "in_progress", label: "In Progress", color: "text-blue-400"   },
  { id: "review",      label: "Review",      color: "text-yellow-400" },
  { id: "done",        label: "Done",        color: "text-green-400"  },
];

const PRIORITY_COLORS = {
  urgent: "bg-red-500/20 text-red-400 border-red-500/30",
  high:   "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low:    "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

// Known assignees — avatar letter + full name for tooltip
const ASSIGNEES = [
  { id: "jose",   label: "Jose",   letter: "J", color: "bg-blue-600"   },
  { id: "crabby", label: "Crabby", letter: "C", color: "bg-orange-500" },
];

function getAssignee(id) {
  return ASSIGNEES.find(a => a.id === id?.toLowerCase()) || {
    id,
    label: id,
    letter: id?.[0]?.toUpperCase() || "?",
    color: "bg-gray-600",
  };
}

export default function TasksPage() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(null);
  const [error,  setError]  = useState(null);

  const { data: tasksByStatus = {}, isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn:  () => tasksApi.getAll(),
  });

  useChannel("TaskUpdatesChannel", () => {
    qc.invalidateQueries({ queryKey: ["tasks"] });
  });

  const createMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setAdding(null);
      setError(null);
    },
    onError: (err) => {
      const msg = err?.response?.data?.error || err.message || "Failed to create task";
      setError(msg);
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status }) => tasksApi.move(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (err) => {
      const msg = err?.response?.data?.error || err.message || "Failed to move card";
      setError(msg);
    },
  });

  const handleDrop = (e, targetStatus) => {
    const id = e.dataTransfer.getData("taskId");
    if (id) moveMutation.mutate({ id, status: targetStatus });
  };

  if (isLoading) return <div className="p-6 text-gray-400 text-sm">Loading tasks…</div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Tasks</h1>
        <p className="text-gray-400 text-sm mt-0.5">Drag cards between columns to move them</p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-950/50 border border-red-800 rounded-lg px-4 py-2.5">
          <p className="text-sm text-red-400 flex-1">{error}</p>
          <button onClick={() => setError(null)}><X size={13} className="text-red-500" /></button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 h-[calc(100vh-170px)]">
        {COLUMNS.map(col => {
          const cards = tasksByStatus[col.id] || [];
          return (
            <div
              key={col.id}
              className="bg-gray-900 border border-gray-800 rounded-lg flex flex-col"
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, col.id)}
            >
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className={cn("text-sm font-semibold", col.color)}>{col.label}</span>
                  <span className="text-xs bg-gray-800 text-gray-400 rounded-full px-2 py-0.5">
                    {cards.length}
                  </span>
                </div>
                <button
                  onClick={() => { setAdding(col.id); setError(null); }}
                  className="text-gray-600 hover:text-orange-400 transition-colors"
                  title="Add card"
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {adding === col.id && (
                  <AddCardForm
                    status={col.id}
                    onSave={(data) => createMutation.mutate({ ...data, status: col.id })}
                    onCancel={() => { setAdding(null); setError(null); }}
                    saving={createMutation.isPending}
                  />
                )}
                {cards.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Add card form ─────────────────────────────────────────────────────────────

function AddCardForm({ onSave, onCancel, saving }) {
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [assignee,    setAssignee]    = useState("");
  const [priority,    setPriority]    = useState("medium");
  const titleRef = useRef(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title: title.trim(), description: description.trim() || null, assignee: assignee || null, priority });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-800 border border-orange-500/50 rounded-md p-3 space-y-2.5"
    >
      {/* Title — required */}
      <input
        ref={titleRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Task title (required)"
        required
        className="w-full bg-gray-900 text-white text-sm rounded px-2.5 py-1.5 outline-none placeholder-gray-600 border border-gray-700 focus:border-orange-500/50"
      />

      {/* Description — optional */}
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description or links… (optional)"
        rows={2}
        className="w-full bg-gray-900 text-white text-xs rounded px-2.5 py-1.5 outline-none placeholder-gray-600 border border-gray-700 focus:border-orange-500/50 resize-none"
      />

      {/* Assignee + Priority row */}
      <div className="flex gap-2">
        <select
          value={assignee}
          onChange={e => setAssignee(e.target.value)}
          className="flex-1 bg-gray-900 text-white text-xs rounded px-2 py-1.5 border border-gray-700 outline-none"
        >
          <option value="">Unassigned</option>
          {ASSIGNEES.map(a => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>

        <select
          value={priority}
          onChange={e => setPriority(e.target.value)}
          className="flex-1 bg-gray-900 text-white text-xs rounded px-2 py-1.5 border border-gray-700 outline-none"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="submit"
          disabled={!title.trim() || saving}
          className="text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-3 py-1.5 rounded transition-colors"
        >
          {saving ? "Adding…" : "Add card"}
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

// ── Task card ─────────────────────────────────────────────────────────────────

function TaskCard({ task }) {
  const assignee = task.assignee ? getAssignee(task.assignee) : null;

  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData("taskId", task.id)}
      className="bg-gray-800 border border-gray-700 rounded-md p-3 cursor-grab active:cursor-grabbing hover:border-gray-600 transition-colors group"
    >
      <div className="flex items-start gap-2">
        <GripVertical
          size={12}
          className="text-gray-600 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        />

        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className="text-sm text-white leading-snug">{task.title}</p>

          {/* Description */}
          {task.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}

          {/* Footer row: priority + due date + assignee avatar */}
          <div className="flex items-center gap-2 mt-2.5">
            {task.priority && task.priority !== "medium" && (
              <span className={cn("text-xs border rounded px-1.5 py-0.5", PRIORITY_COLORS[task.priority])}>
                {task.priority}
              </span>
            )}

            {task.due_date && (
              <span className="text-xs text-gray-600">
                {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}

            {/* Assignee avatar — right-aligned, tooltip on hover */}
            {assignee && (
              <div className="ml-auto relative group/avatar">
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-white font-bold cursor-default",
                  assignee.color
                )}
                  style={{ fontSize: "9px" }}
                >
                  {assignee.letter}
                </div>
                {/* Tooltip */}
                <div className="absolute bottom-full right-0 mb-1.5 px-2 py-1 bg-gray-700 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover/avatar:opacity-100 transition-opacity pointer-events-none z-10">
                  {assignee.label}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
