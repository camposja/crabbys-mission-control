/*
 * Personal To-Dos — Jose only.
 * This feature is intentionally separate from the OpenClaw Task/Kanban system.
 * Crabby / agents do not see, read, or act on these items.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Check, Circle, Archive, ArchiveRestore, ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { personalTodosApi } from "../../api/personalTodos";
import { cn } from "../../lib/utils";

export default function TodosPage() {
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [showArchive, setShowArchive] = useState(false);

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ["personal-todos"],
    queryFn: personalTodosApi.getAll,
  });

  const { data: archivedTodos = [], isLoading: loadingArchived } = useQuery({
    queryKey: ["personal-todos-archived"],
    queryFn: personalTodosApi.getArchived,
    enabled: showArchive,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["personal-todos"] });
    qc.invalidateQueries({ queryKey: ["personal-todos-archived"] });
  };

  const createMutation = useMutation({
    mutationFn: (title) => personalTodosApi.create({ title }),
    onSuccess: () => { invalidate(); setNewTitle(""); },
  });

  const toggleMutation = useMutation({
    mutationFn: (id) => personalTodosApi.toggle(id),
    onSuccess: invalidate,
  });

  const reorderMutation = useMutation({
    mutationFn: ({ id, position }) => personalTodosApi.update(id, { position }),
    onSuccess: invalidate,
  });

  const moveItem = (index, direction) => {
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= pending.length) return;
    const item = pending[index];
    const swapItem = pending[swapIndex];
    // Swap positions using the actual index values so they always differ
    const posA = index;
    const posB = swapIndex;
    Promise.all([
      personalTodosApi.update(item.id, { position: posB }),
      personalTodosApi.update(swapItem.id, { position: posA }),
    ]).then(invalidate);
  };

  const archiveMutation = useMutation({
    mutationFn: (id) => personalTodosApi.archive(id),
    onSuccess: invalidate,
  });

  const unarchiveMutation = useMutation({
    mutationFn: (id) => personalTodosApi.unarchive(id),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => personalTodosApi.destroy(id),
    onSuccess: invalidate,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createMutation.mutate(newTitle.trim());
  };

  const pending = todos.filter(t => !t.done);
  const completed = todos.filter(t => t.done);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">My To-Dos</h1>
        <p className="text-sm text-gray-500 mt-0.5">Personal checklist — just for Jose</p>
      </div>

      {/* Quick add */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a to-do..."
          className="flex-1 bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-4 py-2.5 outline-none focus:border-orange-500/50 placeholder-gray-600"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!newTitle.trim() || createMutation.isPending}
          className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={14} /> Add
        </button>
      </form>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <>
          {/* Empty state */}
          {pending.length === 0 && completed.length === 0 && (
            <div className="text-center py-16 text-gray-600">
              <p className="text-sm">No to-dos yet. Add one above.</p>
            </div>
          )}

          {/* Active items */}
          {pending.length > 0 && (
            <div className="space-y-1 mb-6">
              {pending.map((todo, idx) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  onToggle={() => toggleMutation.mutate(todo.id)}
                  onDelete={() => deleteMutation.mutate(todo.id)}
                  onMoveUp={idx > 0 ? () => moveItem(idx, -1) : null}
                  onMoveDown={idx < pending.length - 1 ? () => moveItem(idx, 1) : null}
                />
              ))}
            </div>
          )}

          {/* Done section */}
          {completed.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-600 uppercase tracking-wide">
                  Done ({completed.length})
                </p>
                <button
                  onClick={() => {
                    completed.forEach(t => archiveMutation.mutate(t.id));
                  }}
                  disabled={archiveMutation.isPending}
                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors"
                >
                  <Archive size={12} /> Archive all done
                </button>
              </div>
              <div className="space-y-1">
                {completed.map(todo => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    onToggle={() => toggleMutation.mutate(todo.id)}
                    onArchive={() => archiveMutation.mutate(todo.id)}
                    onDelete={() => deleteMutation.mutate(todo.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Archive toggle */}
          <div className="border-t border-gray-800 pt-4">
            <button
              onClick={() => setShowArchive(v => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              {showArchive ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Archive size={12} />
              {showArchive ? "Hide archive" : "View archive"}
            </button>

            {showArchive && (
              <div className="mt-3">
                {loadingArchived ? (
                  <p className="text-xs text-gray-600">Loading archived...</p>
                ) : archivedTodos.length === 0 ? (
                  <p className="text-xs text-gray-700">No archived items.</p>
                ) : (
                  <div className="space-y-1">
                    {archivedTodos.map(todo => (
                      <div
                        key={todo.id}
                        className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-950/50 group"
                      >
                        <Check size={16} className="text-gray-700 shrink-0" />
                        <span className="flex-1 text-sm text-gray-700 line-through">{todo.title}</span>
                        <span className="text-[10px] text-gray-800">
                          {todo.archived_at ? new Date(todo.archived_at).toLocaleDateString() : ""}
                        </span>
                        <button
                          onClick={() => unarchiveMutation.mutate(todo.id)}
                          className="text-gray-800 hover:text-gray-400 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                          title="Restore"
                        >
                          <ArchiveRestore size={13} />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(todo.id)}
                          className="text-gray-800 hover:text-red-400 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                          title="Delete permanently"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TodoRow({ todo, onToggle, onArchive, onDelete, onMoveUp, onMoveDown }) {
  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors group",
      todo.done ? "bg-gray-900/50" : "bg-gray-900 border border-gray-800"
    )}>
      <button onClick={onToggle} className="shrink-0">
        {todo.done ? (
          <Check size={18} className="text-green-500" />
        ) : (
          <Circle size={18} className="text-gray-600 hover:text-orange-400 transition-colors" />
        )}
      </button>
      <span className={cn(
        "flex-1 text-sm",
        todo.done ? "text-gray-600 line-through" : "text-white"
      )}>
        {todo.title}
      </span>
      <div className="flex items-center gap-1.5">
        {/* Reorder buttons — always visible for active items, right side */}
        {!todo.done && (
          <>
            <button
              onClick={onMoveUp}
              disabled={!onMoveUp}
              className={cn("transition-colors", onMoveUp ? "text-gray-500 hover:text-white" : "text-gray-800")}
              title="Move up"
            >
              <ChevronUp size={16} />
            </button>
            <button
              onClick={onMoveDown}
              disabled={!onMoveDown}
              className={cn("transition-colors", onMoveDown ? "text-gray-500 hover:text-white" : "text-gray-800")}
              title="Move down"
            >
              <ChevronDown size={16} />
            </button>
          </>
        )}
        {/* Archive + delete — visible on hover */}
        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          {todo.done && onArchive && (
            <button onClick={onArchive} className="text-gray-700 hover:text-gray-400 transition-colors" title="Archive">
              <Archive size={14} />
            </button>
          )}
          <button onClick={onDelete} className="text-gray-700 hover:text-red-400 transition-colors" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
