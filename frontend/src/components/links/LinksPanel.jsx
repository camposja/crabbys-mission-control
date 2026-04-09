import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Link2, Plus, Trash2, X } from "lucide-react";
import { linksApi } from "../../api/links";
import { cn } from "../../lib/utils";

const SOURCE_OPTIONS = [
  ["youtube", "YouTube"],
  ["twitter", "Twitter/X"],
  ["article", "Article"],
  ["docs", "Docs"],
  ["github", "GitHub"],
  ["website", "Website"],
  ["other", "Other"],
];

const SOURCE_BADGES = {
  youtube: "bg-red-500/20 text-red-300 border-red-500/30",
  twitter: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  article: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  docs: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  github: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  website: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  other: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

function formatSourceType(value) {
  const found = SOURCE_OPTIONS.find(([k]) => k === value);
  return found ? found[1] : value || "Other";
}

export default function LinksPanel({ projectId, taskId = null, title = "Links" }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);
  const [url, setUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [sourceType, setSourceType] = useState("other");
  const [notes, setNotes] = useState("");

  const params = useMemo(() => ({ project_id: projectId, ...(taskId ? { task_id: taskId } : {}) }), [projectId, taskId]);
  const queryKey = ["links", params];

  const { data: links = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => linksApi.getAll(params),
    enabled: !!projectId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey });
    if (taskId) qc.invalidateQueries({ queryKey: ["task-detail", taskId] });
    if (projectId) qc.invalidateQueries({ queryKey: ["project", String(projectId)] });
  };

  const createMutation = useMutation({
    mutationFn: () => linksApi.create({
      project_id: projectId,
      task_id: taskId,
      url: url.trim(),
      title: linkTitle.trim() || null,
      source_type: sourceType,
      notes: notes.trim() || null,
    }),
    onSuccess: () => {
      setUrl("");
      setLinkTitle("");
      setSourceType("other");
      setNotes("");
      setShowForm(false);
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err?.response?.data?.error || err.message || "Failed to add link"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => linksApi.destroy(id),
    onSuccess: () => invalidate(),
    onError: (err) => setError(err?.response?.data?.error || err.message || "Failed to delete link"),
  });

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link2 size={14} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setError(null); }}
          className="flex items-center gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1.5 rounded transition-colors"
        >
          {showForm ? <X size={12} /> : <Plus size={12} />}
          {showForm ? "Cancel" : "Add new link"}
        </button>
      </div>

      {error && (
        <div className="mb-3 text-xs text-red-400 bg-red-950/40 border border-red-800 rounded px-3 py-2">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-4 bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-gray-950 text-white text-sm rounded px-2.5 py-1.5 border border-gray-700 outline-none"
          />
          <input
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            placeholder="Title / label (optional)"
            className="w-full bg-gray-950 text-white text-sm rounded px-2.5 py-1.5 border border-gray-700 outline-none"
          />
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="w-full bg-gray-950 text-white text-sm rounded px-2.5 py-1.5 border border-gray-700 outline-none"
          >
            {SOURCE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes / context (optional)"
            rows={2}
            className="w-full bg-gray-950 text-white text-sm rounded px-2.5 py-1.5 border border-gray-700 outline-none resize-none"
          />
          <button
            onClick={() => createMutation.mutate()}
            disabled={!url.trim() || createMutation.isPending}
            className="text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-3 py-1.5 rounded transition-colors"
          >
            {createMutation.isPending ? "Saving..." : "Save link"}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-gray-400">Loading links...</div>
      ) : links.length === 0 ? (
        <div className="text-sm text-gray-500">No links saved yet.</div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <div key={link.id} className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-3 group">
              <div className="flex items-start gap-3">
                <Link2 size={14} className="text-gray-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className={cn("text-[11px] border rounded px-1.5 py-0.5", SOURCE_BADGES[link.source_type] || SOURCE_BADGES.other)}>
                      {formatSourceType(link.source_type)}
                    </span>
                    {taskId == null && link.task_id && (
                      <span className="text-[11px] text-gray-500">task #{link.task_id}</span>
                    )}
                  </div>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-white hover:text-orange-300 transition-colors break-all inline-flex items-center gap-1"
                  >
                    {link.title || link.url}
                    <ExternalLink size={12} className="shrink-0" />
                  </a>
                  {link.title && (
                    <div className="text-xs text-gray-500 break-all mt-1">{link.url}</div>
                  )}
                  {link.notes && (
                    <div className="text-xs text-gray-400 mt-1.5 whitespace-pre-wrap">{link.notes}</div>
                  )}
                </div>
                <button
                  onClick={() => deleteMutation.mutate(link.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
                  title="Delete link"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
