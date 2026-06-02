import { useState } from "react";
import { X, Loader2 } from "lucide-react";

const STATUS_OPTIONS = [
  ["active", "Active"],
  ["completed", "Completed"],
  ["archived", "Archived"],
];

/**
 * Create/edit form for a Course. Pass `course` to edit, omit to create.
 */
export default function CourseForm({ course = null, onSubmit, onCancel, saving = false, error = null }) {
  const isEdit = !!course;
  const [title, setTitle] = useState(course?.title || "");
  const [description, setDescription] = useState(course?.description || "");
  const [provider, setProvider] = useState(course?.provider || "");
  const [status, setStatus] = useState(course?.status || "active");
  const [diploma, setDiploma] = useState(course?.diploma || false);
  const [diplomaNotes, setDiplomaNotes] = useState(course?.diploma_notes || "");
  const [startedOn, setStartedOn] = useState(course?.started_on || "");
  const [completedOn, setCompletedOn] = useState(course?.completed_on || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      provider: provider.trim() || null,
      status,
      diploma,
      diploma_notes: diploma ? (diplomaNotes.trim() || null) : null,
      started_on: startedOn || null,
      completed_on: completedOn || null,
    });
  };

  return (
    <div className="mb-6 bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">{isEdit ? "Edit Course" : "New Course"}</h2>
        <button onClick={onCancel} className="text-gray-500 hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>

      {error && (
        <div className="mb-3 text-xs text-red-400 bg-red-950/40 border border-red-800 rounded px-3 py-2">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Course title (required)"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="Provider (optional)"
            className="w-full bg-gray-900 text-white text-xs rounded px-2.5 py-1.5 outline-none placeholder-gray-600 border border-gray-700 focus:border-orange-500/50"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full bg-gray-900 text-white text-xs rounded px-2 py-1.5 border border-gray-700 outline-none"
          >
            {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label className="text-xs text-gray-400 flex flex-col gap-1">
            Started on
            <input type="date" value={startedOn || ""} onChange={(e) => setStartedOn(e.target.value)}
              className="bg-gray-900 text-white text-xs rounded px-2 py-1.5 border border-gray-700 outline-none" />
          </label>
          <label className="text-xs text-gray-400 flex flex-col gap-1">
            Completed on
            <input type="date" value={completedOn || ""} onChange={(e) => setCompletedOn(e.target.value)}
              className="bg-gray-900 text-white text-xs rounded px-2 py-1.5 border border-gray-700 outline-none" />
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-300">
          <input type="checkbox" checked={diploma} onChange={(e) => setDiploma(e.target.checked)}
            className="accent-orange-500" />
          Has diploma / completion test
        </label>
        {diploma && (
          <textarea
            value={diplomaNotes}
            onChange={(e) => setDiplomaNotes(e.target.value)}
            placeholder="Diploma / test notes (optional)"
            rows={2}
            className="w-full bg-gray-900 text-white text-xs rounded px-2.5 py-1.5 outline-none placeholder-gray-600 border border-gray-700 focus:border-orange-500/50 resize-none"
          />
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={!title.trim() || saving}
            className="text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
          >
            {saving && <Loader2 size={11} className="animate-spin" />}
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Course"}
          </button>
          <button type="button" onClick={onCancel} className="text-xs text-gray-500 hover:text-white transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
