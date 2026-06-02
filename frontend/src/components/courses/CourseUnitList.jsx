import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Layers, Trash2, Loader2, Pencil, ChevronUp, ChevronDown, Check } from "lucide-react";
import { coursesApi } from "../../api/courses";
import { cn } from "../../lib/utils";

const UNIT_TYPES = [
  ["topic", "Topic"],
  ["sequential", "Sequential"],
  ["general", "General"],
];

const UNIT_TYPE_BADGE = {
  topic: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  sequential: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  general: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

export default function CourseUnitList({ courseId, units = [], selectedUnitId, onSelect }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [unitType, setUnitType] = useState("topic");
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState("topic");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["course", String(courseId)] });

  const createMutation = useMutation({
    mutationFn: () => coursesApi.createUnit(courseId, { title: title.trim(), unit_type: unitType }),
    onSuccess: () => { setTitle(""); setUnitType("topic"); setShowForm(false); setError(null); invalidate(); },
    onError: (err) => setError(err?.response?.data?.error || err.message || "Failed to add unit"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ unitId, data }) => coursesApi.updateUnit(courseId, unitId, data),
    onSuccess: () => { setEditingId(null); setError(null); invalidate(); },
    onError: (err) => setError(err?.response?.data?.error || err.message || "Failed to update unit"),
  });

  const deleteMutation = useMutation({
    mutationFn: (unitId) => coursesApi.destroyUnit(courseId, unitId),
    onSuccess: (_d, unitId) => { if (unitId === selectedUnitId) onSelect(null); invalidate(); },
    onError: (err) => setError(err?.response?.data?.error || err.message || "Failed to delete unit"),
  });

  // Atomic reorder: send the full ordered id list; snap back to server truth on error.
  const reorderMutation = useMutation({
    mutationFn: (orderedIds) => coursesApi.reorderUnits(courseId, orderedIds),
    onSuccess: () => invalidate(),
    onError: (err) => { setError(err?.response?.data?.error || err.message || "Failed to reorder"); invalidate(); },
  });

  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= units.length) return;
    const ids = units.map((u) => u.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMutation.mutate(ids);
  };

  const startEdit = (unit) => {
    setEditingId(unit.id);
    setEditTitle(unit.title || "");
    setEditType(unit.unit_type || "topic");
    setError(null);
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-white">Units</h3>
          <span className="text-xs text-gray-500">{units.length}</span>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setError(null); }}
          className="flex items-center gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1.5 rounded transition-colors"
        >
          {showForm ? <X size={12} /> : <Plus size={12} />}
          {showForm ? "Cancel" : "Add unit"}
        </button>
      </div>

      {error && (
        <div className="mb-3 text-xs text-red-400 bg-red-950/40 border border-red-800 rounded px-3 py-2">{error}</div>
      )}

      {showForm && (
        <div className="mb-3 bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Unit title (e.g. Development, Module 1)"
            className="w-full bg-gray-950 text-white text-sm rounded px-2.5 py-1.5 border border-gray-700 outline-none"
          />
          <select
            value={unitType}
            onChange={(e) => setUnitType(e.target.value)}
            className="w-full bg-gray-950 text-white text-sm rounded px-2.5 py-1.5 border border-gray-700 outline-none"
          >
            {UNIT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button
            onClick={() => title.trim() && createMutation.mutate()}
            disabled={!title.trim() || createMutation.isPending}
            className="text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
          >
            {createMutation.isPending && <Loader2 size={11} className="animate-spin" />}
            Save unit
          </button>
        </div>
      )}

      {units.length === 0 ? (
        <div className="text-sm text-gray-500">No units yet.</div>
      ) : (
        <div className="space-y-1.5">
          {units.map((unit, index) => {
            const isActive = unit.id === selectedUnitId;
            const isEditing = unit.id === editingId;
            const noteCount = unit.notes?.length ?? 0;
            const linkCount = unit.links?.length ?? 0;

            if (isEditing) {
              return (
                <div key={unit.id} className="bg-gray-900 border border-orange-500/40 rounded-lg p-2.5 space-y-2">
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-gray-950 text-white text-sm rounded px-2.5 py-1.5 border border-gray-700 outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      className="flex-1 bg-gray-950 text-white text-sm rounded px-2.5 py-1.5 border border-gray-700 outline-none"
                    >
                      {UNIT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <button
                      onClick={() => editTitle.trim() && updateMutation.mutate({ unitId: unit.id, data: { title: editTitle.trim(), unit_type: editType } })}
                      disabled={!editTitle.trim() || updateMutation.isPending}
                      className="text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-2.5 py-1.5 rounded transition-colors flex items-center gap-1"
                      title="Save"
                    >
                      <Check size={13} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-white" title="Cancel">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={unit.id}
                className={cn(
                  "flex items-center gap-2 px-2 py-2 rounded-lg border transition-colors group",
                  isActive ? "bg-orange-500/10 border-orange-500/40" : "bg-gray-900 border-gray-700 hover:border-gray-600"
                )}
              >
                {/* Reorder controls */}
                <div className="flex flex-col -my-1">
                  <button
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || reorderMutation.isPending}
                    className="text-gray-600 hover:text-white disabled:opacity-20 disabled:hover:text-gray-600"
                    title="Move up"
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    onClick={() => move(index, 1)}
                    disabled={index === units.length - 1 || reorderMutation.isPending}
                    className="text-gray-600 hover:text-white disabled:opacity-20 disabled:hover:text-gray-600"
                    title="Move down"
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>

                <button onClick={() => onSelect(isActive ? null : unit.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                  <span className="text-gray-500 text-xs w-4 shrink-0">{unit.position}</span>
                  <span className="text-sm text-white flex-1 truncate">{unit.title}</span>
                  <span className={cn("text-[11px] border rounded px-1.5 py-0.5 shrink-0", UNIT_TYPE_BADGE[unit.unit_type] || UNIT_TYPE_BADGE.general)}>
                    {unit.unit_type}
                  </span>
                  <span className="text-[11px] text-gray-500 shrink-0">{noteCount}n · {linkCount}l</span>
                </button>

                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                  <button onClick={() => startEdit(unit)} className="text-gray-600 hover:text-orange-300" title="Edit unit">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => deleteMutation.mutate(unit.id)} className="text-gray-600 hover:text-red-400" title="Delete unit">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
