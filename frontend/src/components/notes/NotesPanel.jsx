import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, NotebookPen, Plus, Trash2, X, Pencil } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { notesApi } from "../../api/notes";
import { cn } from "../../lib/utils";

const NOTE_TYPES = [
  ["course_material", "Course material"],
  ["personal", "My notes"],
];

// Visual distinction: source/course material (amber) vs personal notes (blue).
const TYPE_META = {
  course_material: {
    label: "Course material",
    icon: BookOpen,
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    accent: "border-l-amber-500/60",
  },
  personal: {
    label: "My notes",
    icon: NotebookPen,
    badge: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    accent: "border-l-sky-500/60",
  },
};

/**
 * Reusable notes panel for the polymorphic Note model.
 * @param owner { notable_type, notable_id }
 */
export default function NotesPanel({ owner, title = "Notes" }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);
  const [noteType, setNoteType] = useState("course_material");
  const [noteTitle, setNoteTitle] = useState("");
  const [body, setBody] = useState("");
  const [author, setAuthor] = useState("");
  const [editingId, setEditingId] = useState(null);

  const params = useMemo(() => ({ ...owner }), [owner]);
  const hasOwner = !!(owner?.notable_type && owner?.notable_id);
  const queryKey = ["notes", params];

  const { data: notes = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => notesApi.getAll(params),
    enabled: hasOwner,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: ["course"] });
  };

  const resetForm = () => {
    setNoteType("course_material");
    setNoteTitle("");
    setBody("");
    setAuthor("");
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        note_type: noteType,
        title: noteTitle.trim() || null,
        body: body.trim(),
        author: author.trim() || null,
      };
      return editingId
        ? notesApi.update(editingId, payload)
        : notesApi.create({ ...owner, ...payload });
    },
    onSuccess: () => { resetForm(); invalidate(); },
    onError: (err) => setError(err?.response?.data?.error || err.message || "Failed to save note"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => notesApi.destroy(id),
    onSuccess: () => invalidate(),
    onError: (err) => setError(err?.response?.data?.error || err.message || "Failed to delete note"),
  });

  const startEdit = (note) => {
    setEditingId(note.id);
    setNoteType(note.note_type);
    setNoteTitle(note.title || "");
    setBody(note.body || "");
    setAuthor(note.author || "");
    setShowForm(true);
    setError(null);
  };

  const grouped = useMemo(() => ({
    course_material: notes.filter((n) => n.note_type === "course_material"),
    personal: notes.filter((n) => n.note_type === "personal"),
  }), [notes]);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <NotebookPen size={14} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="flex items-center gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1.5 rounded transition-colors"
        >
          {showForm ? <X size={12} /> : <Plus size={12} />}
          {showForm ? "Cancel" : "Add note"}
        </button>
      </div>

      {error && (
        <div className="mb-3 text-xs text-red-400 bg-red-950/40 border border-red-800 rounded px-3 py-2">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-4 bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-2">
          {/* Type toggle */}
          <div className="flex gap-1.5">
            {NOTE_TYPES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setNoteType(value)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded border transition-colors",
                  noteType === value
                    ? TYPE_META[value].badge
                    : "bg-gray-950 text-gray-400 border-gray-700 hover:text-white"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full bg-gray-950 text-white text-sm rounded px-2.5 py-1.5 border border-gray-700 outline-none"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Note body (markdown supported)"
            rows={4}
            className="w-full bg-gray-950 text-white text-sm rounded px-2.5 py-1.5 border border-gray-700 outline-none resize-none"
          />
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Author (optional)"
            className="w-full bg-gray-950 text-white text-sm rounded px-2.5 py-1.5 border border-gray-700 outline-none"
          />
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!body.trim() || saveMutation.isPending}
            className="text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-3 py-1.5 rounded transition-colors"
          >
            {saveMutation.isPending ? "Saving..." : editingId ? "Update note" : "Save note"}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-gray-400">Loading notes...</div>
      ) : notes.length === 0 ? (
        <div className="text-sm text-gray-500">No notes saved yet.</div>
      ) : (
        <div className="space-y-4">
          {NOTE_TYPES.map(([type]) => {
            const items = grouped[type];
            if (items.length === 0) return null;
            const meta = TYPE_META[type];
            const Icon = meta.icon;
            return (
              <div key={type}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon size={12} className="text-gray-400" />
                  <span className={cn("text-[11px] border rounded px-1.5 py-0.5", meta.badge)}>
                    {meta.label}
                  </span>
                  <span className="text-[11px] text-gray-500">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((note) => (
                    <div
                      key={note.id}
                      className={cn("bg-gray-900 border border-gray-700 border-l-2 rounded-lg px-3 py-2.5 group", meta.accent)}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          {note.title && (
                            <div className="text-sm font-medium text-white mb-1">{note.title}</div>
                          )}
                          <div className="text-xs text-gray-300 prose-invert max-w-none break-words [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_a]:text-orange-300">
                            <ReactMarkdown>{note.body || ""}</ReactMarkdown>
                          </div>
                          {note.author && (
                            <div className="text-[11px] text-gray-500 mt-1.5">— {note.author}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => startEdit(note)}
                            className="text-gray-600 hover:text-orange-300"
                            title="Edit note"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(note.id)}
                            className="text-gray-600 hover:text-red-400"
                            title="Delete note"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
