import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, GripVertical } from "lucide-react";
import { tasksApi } from "../../api/tasks";
import { useChannel } from "../../hooks/useChannel";
import { cn } from "../../lib/utils";

const COLUMNS = [
  { id: "backlog",     label: "Backlog",      color: "text-gray-400"   },
  { id: "in_progress", label: "In Progress",  color: "text-blue-400"   },
  { id: "review",      label: "Review",       color: "text-yellow-400" },
  { id: "done",        label: "Done",         color: "text-green-400"  },
];

const PRIORITY_COLORS = {
  urgent: "bg-red-500/20 text-red-400 border-red-500/30",
  high:   "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low:    "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export default function TasksPage() {
  const qc = useQueryClient();
  const [newTask, setNewTask] = useState({ title: "", status: "backlog" });
  const [adding, setAdding] = useState(null); // which column is open

  const { data: tasksByStatus = {}, isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => tasksApi.getAll(),
  });

  // Live Kanban updates from Action Cable
  useChannel("TaskUpdatesChannel", () => {
    qc.invalidateQueries({ queryKey: ["tasks"] });
  });

  const createMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setAdding(null);
      setNewTask({ title: "", status: "backlog" });
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status }) => tasksApi.move(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const handleDrop = (e, targetStatus) => {
    const id = e.dataTransfer.getData("taskId");
    if (id) moveMutation.mutate({ id, status: targetStatus });
  };

  if (isLoading) return <div className="p-6 text-gray-400 text-sm">Loading tasks…</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="text-gray-400 text-sm mt-0.5">Kanban board — drag cards to move them</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 h-[calc(100vh-160px)]">
        {COLUMNS.map(col => {
          const cards = tasksByStatus[col.id] || [];
          return (
            <div
              key={col.id}
              className="bg-gray-900 border border-gray-800 rounded-lg flex flex-col"
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, col.id)}
            >
              {/* Column header */}
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("text-sm font-semibold", col.color)}>{col.label}</span>
                  <span className="text-xs bg-gray-800 text-gray-400 rounded-full px-2 py-0.5">
                    {cards.length}
                  </span>
                </div>
                <button
                  onClick={() => setAdding(col.id)}
                  className="text-gray-600 hover:text-white transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {adding === col.id && (
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      createMutation.mutate({ title: newTask.title, status: col.id });
                    }}
                    className="bg-gray-800 rounded-md p-2 border border-orange-500/50"
                  >
                    <input
                      autoFocus
                      value={newTask.title}
                      onChange={e => setNewTask({ title: e.target.value, status: col.id })}
                      placeholder="Task title…"
                      className="w-full bg-transparent text-white text-sm outline-none placeholder-gray-500"
                    />
                    <div className="flex gap-2 mt-2">
                      <button type="submit" className="text-xs bg-orange-500 text-white px-2 py-1 rounded">
                        Add
                      </button>
                      <button type="button" onClick={() => setAdding(null)} className="text-xs text-gray-500">
                        Cancel
                      </button>
                    </div>
                  </form>
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

function TaskCard({ task }) {
  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData("taskId", task.id)}
      className="bg-gray-800 border border-gray-700 rounded-md p-3 cursor-grab active:cursor-grabbing hover:border-gray-600 transition-colors group"
    >
      <div className="flex items-start gap-2">
        <GripVertical size={12} className="text-gray-600 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white leading-snug">{task.title}</p>
          {task.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {task.priority && (
              <span className={cn("text-xs border rounded px-1.5 py-0.5", PRIORITY_COLORS[task.priority])}>
                {task.priority}
              </span>
            )}
            {task.assignee && (
              <span className="text-xs text-gray-500">{task.assignee}</span>
            )}
            {task.due_date && (
              <span className="text-xs text-gray-500 ml-auto">
                {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
