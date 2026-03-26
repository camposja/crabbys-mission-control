import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus, X, Bot, Circle, RefreshCw } from "lucide-react";
import { tasksApi } from "../../api/tasks";
import { projectsApi } from "../../api/projects";
import { useChannel } from "../../hooks/useChannel";
import { cn } from "../../lib/utils";
import PlanningModal from "../../components/tasks/PlanningModal";
import TaskDetailDialog from "../../components/tasks/TaskDetailDialog";

const COLUMNS = [
  { id: "backlog",     label: "Backlog",     color: "text-gray-400",   dot: "bg-gray-500"   },
  { id: "recurring",   label: "Recurring",   color: "text-purple-400", dot: "bg-purple-500" },
  { id: "in_progress", label: "In Progress", color: "text-blue-400",   dot: "bg-blue-500"   },
  { id: "review",      label: "Review",      color: "text-yellow-400", dot: "bg-yellow-500" },
  { id: "done",        label: "Done",        color: "text-green-400",  dot: "bg-green-500"  },
];

const PRIORITY_COLORS = {
  urgent: "bg-red-500/20 text-red-400 border-red-500/30",
  high:   "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low:    "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const AGENT_STATUS_COLORS = {
  spawned:       "text-blue-400",
  running:       "text-green-400",
  done:          "text-green-500",
  spawn_failed:  "text-red-400",
  idle:          "text-gray-500",
};

/*
 * ASSIGNEE AVATAR CONFIG — INTENTIONALLY FIXED
 * Jose (🧑🏽‍💻) and Crabby (🦀) avatar emojis and circle colors are
 * intentionally set for product identity. Do not change these emoji
 * choices, circle colors, or sizing without an explicit request.
 */
const ASSIGNEES = [
  { id: "jose",   label: "Jose",   letter: "🧑🏽‍💻", color: "bg-stone-500"   },
  { id: "crabby", label: "Crabby", letter: "🦀",      color: "bg-yellow-900" },
];

function getAssignee(id) {
  return ASSIGNEES.find(a => a.id === id?.toLowerCase()) || {
    id, label: id, letter: id?.[0]?.toUpperCase() || "?", color: "bg-gray-600",
  };
}

export default function TasksPage() {
  const qc = useQueryClient();
  const [adding,             setAdding]             = useState(null);
  const [error,              setError]              = useState(null);
  const [planningTask,       setPlanningTask]       = useState(null);
  const [selectedProjectId,  setSelectedProjectId]  = useState(null);
  const [detailTaskId,       setDetailTaskId]       = useState(null);

  const taskParams = selectedProjectId ? { project_id: selectedProjectId } : {};

  const { data: tasksByStatus = {}, isLoading } = useQuery({
    queryKey: ["tasks", { project_id: selectedProjectId }],
    queryFn:  () => tasksApi.getAll(taskParams),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn:  projectsApi.getAll,
  });

  // Build a lookup map for project data by id
  const projectMap = {};
  projects.forEach(p => { projectMap[p.id] = p; });

  useChannel("TaskUpdatesChannel", () => {
    qc.invalidateQueries({ queryKey: ["tasks"] });
  });

  const createMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setAdding(null);
      setError(null);
      // Open planning modal automatically when assigned to crabby
      if (task.assignee === "crabby") {
        setPlanningTask(task);
      }
    },
    onError: (err) => {
      setError(err?.response?.data?.error || err.message || "Failed to create task");
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, column }) => tasksApi.move(id, column),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (err) => {
      setError(err?.response?.data?.error || err.message || "Failed to move card");
      qc.invalidateQueries({ queryKey: ["tasks"] }); // revert optimistic UI
    },
  });

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newColumn = destination.droppableId;
    const task = Object.values(tasksByStatus).flat().find(t => String(t.id) === draggableId);
    if (task && task.status !== newColumn) {
      moveMutation.mutate({ id: task.id, column: newColumn });
    }
  };

  if (isLoading) return <div className="p-6 text-gray-400 text-sm">Loading tasks…</div>;

  const allTasks = Object.values(tasksByStatus).flat();

  return (
    <div className="p-6 h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {allTasks.length} task{allTasks.length !== 1 ? "s" : ""} · drag cards between columns
          </p>
        </div>
        {moveMutation.isPending && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <RefreshCw size={11} className="animate-spin" /> Moving…
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 shrink-0 flex items-center gap-2 bg-red-950/50 border border-red-800 rounded-lg px-4 py-2.5">
          <p className="text-sm text-red-400 flex-1">{error}</p>
          <button onClick={() => setError(null)}><X size={13} className="text-red-500" /></button>
        </div>
      )}

      {/* Project filter */}
      {projects.length > 0 && (
        <div className="flex items-center gap-3 mb-4 px-1 shrink-0">
          <span className="text-sm text-gray-400">Project:</span>
          {selectedProjectId && projectMap[selectedProjectId] && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: projectMap[selectedProjectId].color || "#6b7280" }}
            />
          )}
          <select
            value={selectedProjectId || ""}
            onChange={e => setSelectedProjectId(e.target.value || null)}
            className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:border-orange-500"
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Kanban board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-5 gap-4 flex-1 min-h-0">
          {COLUMNS.map(col => {
            const cards = tasksByStatus[col.id] || [];
            return (
              <div key={col.id} className="bg-gray-900 border border-gray-800 rounded-lg flex flex-col min-h-0">

                {/* Column header */}
                <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", col.dot)} />
                    <span className={cn("text-sm font-semibold", col.color)}>{col.label}</span>
                    <span className="text-xs bg-gray-800 text-gray-400 rounded-full px-2 py-0.5">
                      {cards.length}
                    </span>
                  </div>
                  <button
                    onClick={() => { setAdding(col.id); setError(null); }}
                    className="text-gray-600 hover:text-orange-400 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Droppable area */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "flex-1 overflow-y-auto p-2 space-y-2 transition-colors",
                        snapshot.isDraggingOver && "bg-gray-800/40"
                      )}
                    >
                      {adding === col.id && (
                        <AddCardForm
                          status={col.id}
                          projects={projects}
                          onSave={(data) => createMutation.mutate({ ...data, status: col.id })}
                          onCancel={() => { setAdding(null); setError(null); }}
                          saving={createMutation.isPending}
                        />
                      )}

                      {cards.map((task, index) => (
                        <Draggable key={String(task.id)} draggableId={String(task.id)} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              <TaskCard
                                task={task}
                                isDragging={snapshot.isDragging}
                                onPlan={() => setPlanningTask(task)}
                                onClick={() => setDetailTaskId(task.id)}
                                project={task.project_id ? projectMap[task.project_id] : null}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Planning modal */}
      {planningTask && (
        <PlanningModal
          task={planningTask}
          onApproved={() => {
            setPlanningTask(null);
            qc.invalidateQueries({ queryKey: ["tasks"] });
          }}
          onSkip={() => setPlanningTask(null)}
          onClose={() => setPlanningTask(null)}
        />
      )}

      {/* Task detail dialog */}
      <TaskDetailDialog
        taskId={detailTaskId}
        open={!!detailTaskId}
        onClose={() => { setDetailTaskId(null); qc.invalidateQueries({ queryKey: ["tasks"] }); }}
      />
    </div>
  );
}

// ── Add card form ─────────────────────────────────────────────────────────────

function AddCardForm({ onSave, onCancel, saving, projects }) {
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState([]);
  const [priority,    setPriority]    = useState("medium");
  const [projectId,   setProjectId]   = useState("");
  const [dueDate,     setDueDate]     = useState("");
  const titleRef = useRef(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  const toggleAssignee = (id) => {
    setSelectedAssignees(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title:      title.trim(),
      description: description.trim() || null,
      assignee:   selectedAssignees[0] || null,
      assignees:  selectedAssignees,
      priority,
      project_id: projectId || null,
      due_date:   dueDate || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 border border-orange-500/50 rounded-md p-3 space-y-2">
      <input
        ref={titleRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Task title (required)"
        required
        className="w-full bg-gray-900 text-white text-sm rounded px-2.5 py-1.5 outline-none placeholder-gray-600 border border-gray-700 focus:border-orange-500/50"
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description or links… (optional)"
        rows={2}
        className="w-full bg-gray-900 text-white text-xs rounded px-2.5 py-1.5 outline-none placeholder-gray-600 border border-gray-700 focus:border-orange-500/50 resize-none"
      />
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2">
          {ASSIGNEES.map(a => (
            <button
              key={a.id}
              type="button"
              onClick={() => toggleAssignee(a.id)}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border transition-colors",
                selectedAssignees.includes(a.id)
                  ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
                  : "bg-gray-900 border-gray-700 text-gray-500 hover:text-white"
              )}
            >
              <span style={{ fontSize: "18px", lineHeight: 1 }}>{a.letter}</span> {a.label}
            </button>
          ))}
        </div>
        <select value={priority} onChange={e => setPriority(e.target.value)}
          className="flex-1 bg-gray-900 text-white text-xs rounded px-2 py-1.5 border border-gray-700 outline-none">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>
      {projects.length > 0 && (
        <select value={projectId} onChange={e => setProjectId(e.target.value)}
          className="w-full bg-gray-900 text-white text-xs rounded px-2 py-1.5 border border-gray-700 outline-none">
          <option value="">No project</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
        className="w-full bg-gray-900 text-white text-xs rounded px-2.5 py-1.5 border border-gray-700 outline-none"
      />
      <div className="flex items-center gap-2 pt-0.5">
        <button type="submit" disabled={!title.trim() || saving}
          className="text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-3 py-1.5 rounded transition-colors">
          {saving ? "Adding…" : "Add card"}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-gray-500 hover:text-white transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Task card ─────────────────────────────────────────────────────────────────

function TaskCard({ task, isDragging, onPlan, onClick, project }) {
  const taskAssignees = (task.assignees?.length ? task.assignees : (task.assignee ? [task.assignee] : [])).map(a => getAssignee(a));
  const agentStatusColor = AGENT_STATUS_COLORS[task.agent_status] || "text-gray-600";
  const hasAgent = task.openclaw_agent_id;

  return (
    <div
      onClick={onClick}
      className={cn(
      "bg-gray-800 border rounded-md p-3 transition-all relative cursor-pointer",
      isDragging
        ? "border-orange-500/50 shadow-lg shadow-orange-500/10 rotate-1 scale-[1.02]"
        : "border-gray-700 hover:border-gray-600"
    )}>
      {/* Project color dot */}
      {project && (
        <span
          className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full"
          style={{ backgroundColor: project.color || "#6b7280" }}
          title={project.name}
        />
      )}

      {/* Title */}
      <p className="text-sm text-white leading-snug pr-4">{task.title}</p>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Agent status badge */}
      {hasAgent && (
        <div className={cn("flex items-center gap-1 mt-2", agentStatusColor)}>
          <Bot size={10} />
          <span className="text-xs">{task.agent_status || "agent active"}</span>
          {task.openclaw_agent_id && (
            <span className="text-xs text-gray-700 font-mono ml-1 truncate max-w-[80px]">
              {task.openclaw_agent_id}
            </span>
          )}
        </div>
      )}

      {/* Plan button for unplanned crabby tasks */}
      {task.assignee === "crabby" && !task.plan_approved_at && !hasAgent && (
        <button
          onClick={(e) => { e.stopPropagation(); onPlan(); }}
          className="mt-2 text-xs text-orange-400/70 hover:text-orange-400 transition-colors"
        >
          + Open planning mode
        </button>
      )}

      {/* Footer: priority + project + due date + assignee */}
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
        {taskAssignees.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            {taskAssignees.map((a, idx) => (
              <div key={a.id || idx} className="relative group/avatar">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center cursor-default",
                  a.color
                )} style={{ fontSize: "26px", lineHeight: 1 }}>
                  {a.letter}
                </div>
                <div className="absolute bottom-full right-0 mb-1.5 px-2 py-1 bg-gray-700 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover/avatar:opacity-100 transition-opacity pointer-events-none z-10">
                  {a.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
