import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookKey, Plus, Pin, Search, Trash2, ExternalLink, Save, X } from "lucide-react";
import { opsNotesApi } from "../../api/opsNotes";
import { cn } from "../../lib/utils";

const SOURCE_TYPES = ["official_docs", "github", "stack_overflow", "blog", "personal_reference", "forum"];
const STATUSES = ["active", "archived"];
const FORMATS = ["markdown", "plain"];

export default function OpsNotesPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ q: "", category: "", tag: "", pinned: false });
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ops-notes", filters],
    queryFn: () => opsNotesApi.getAll(filters),
  });

  const notes = useMemo(() => data?.notes || [], [data]);
  const meta = data?.meta || { categories: [], tags: [] };
  const selected = useMemo(() => notes.find(n => n.id === selectedId) || notes[0] || null, [notes, selectedId]);

  const deleteMutation = useMutation({
    mutationFn: (id) => opsNotesApi.destroy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ops-notes"] });
      setSelectedId(null);
    },
  });

  return (
    <div className="p-6 h-screen flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Openclaw Commands</h1>
          <p className="text-sm text-gray-400 mt-0.5">Ops Cheatsheet</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? "Close" : "New Note"}
        </button>
      </div>

      {showForm && (
        <OpsNoteForm
          onSaved={(note) => {
            setShowForm(false);
            setSelectedId(note.id);
            qc.invalidateQueries({ queryKey: ["ops-notes"] });
          }}
        />
      )}

      <div className="grid grid-cols-12 gap-5 flex-1 min-h-0">
        <div className="col-span-4 bg-gray-900 border border-gray-800 rounded-xl flex flex-col min-h-0">
          <div className="p-4 border-b border-gray-800 space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                value={filters.q}
                onChange={(e) => setFilters(f => ({ ...f, q: e.target.value }))}
                placeholder="Search commands, notes, troubleshooting..."
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg pl-9 pr-3 py-2 outline-none focus:border-orange-500/50"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <select value={filters.category} onChange={(e) => setFilters(f => ({ ...f, category: e.target.value }))}
                className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-2 outline-none">
                <option value="">All categories</option>
                {meta.categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filters.tag} onChange={(e) => setFilters(f => ({ ...f, tag: e.target.value }))}
                className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-2 outline-none">
                <option value="">All tags</option>
                {meta.tags.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button
                onClick={() => setFilters(f => ({ ...f, pinned: !f.pinned }))}
                className={cn(
                  "text-xs rounded px-2 py-2 border transition-colors",
                  filters.pinned ? "bg-orange-500/15 text-orange-400 border-orange-500/40" : "bg-gray-800 text-gray-400 border-gray-700"
                )}
              >
                Pinned only
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
            {isLoading ? (
              <div className="p-4 text-sm text-gray-500">Loading notes…</div>
            ) : notes.length === 0 ? (
              <div className="p-6 text-sm text-gray-500 text-center">No ops notes found.</div>
            ) : notes.map(note => (
              <button
                key={note.id}
                onClick={() => setSelectedId(note.id)}
                className={cn(
                  "w-full text-left p-4 transition-colors hover:bg-gray-800/50",
                  selected?.id === note.id && "bg-orange-500/10"
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white truncate">{note.title}</p>
                      {note.pinned && <Pin size={12} className="text-orange-400 shrink-0" />}
                    </div>
                    {note.category && <p className="text-xs text-gray-500 mt-0.5">{note.category}</p>}
                    {note.command_snippet && <p className="text-xs text-orange-300 mt-2 font-mono truncate">{note.command_snippet}</p>}
                    {note.tags?.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-2">
                        {note.tags.slice(0, 4).map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">#{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-8 bg-gray-900 border border-gray-800 rounded-xl min-h-0 overflow-hidden">
          {selected ? (
            <OpsNoteDetail note={selected} onDelete={() => deleteMutation.mutate(selected.id)} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <BookKey size={36} className="mb-3 text-gray-700" />
              <p>Select a note to view details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OpsNoteDetail({ note, onDelete }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  return (
    <div className="h-full flex flex-col">
      <div className="p-5 border-b border-gray-800 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white truncate">{note.title}</h2>
            {note.pinned && <Pin size={14} className="text-orange-400" />}
          </div>
          <p className="text-sm text-gray-400 mt-1">{note.category || "uncategorized"} · {note.status}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditing(v => !v)} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded">{editing ? "Cancel" : "Edit"}</button>
          <button onClick={onDelete} className="text-xs bg-red-500/15 hover:bg-red-500/25 text-red-400 px-3 py-1.5 rounded flex items-center gap-1.5"><Trash2 size={12} /> Delete</button>
        </div>
      </div>

      {editing ? (
        <div className="p-5 overflow-y-auto"><OpsNoteForm note={note} onSaved={() => { setEditing(false); qc.invalidateQueries({ queryKey: ["ops-notes"] }); }} /></div>
      ) : (
        <div className="p-5 overflow-y-auto space-y-5">
          {note.command_snippet && (
            <div>
              <p className="text-[11px] uppercase tracking-widest text-orange-400 font-medium mb-2">Command</p>
              <div className="bg-gray-950 border border-gray-800 rounded-xl px-4 py-4">
                <pre className="text-white text-lg font-bold whitespace-pre-wrap break-words">{note.command_snippet}</pre>
              </div>
            </div>
          )}

          <div>
            <p className="text-[11px] uppercase tracking-widest text-gray-500 font-medium mb-2">Explanation</p>
            <div className="bg-gray-950 border border-gray-800 rounded-xl px-4 py-4 whitespace-pre-wrap text-sm text-gray-200 leading-relaxed min-h-[140px]">
              {note.body || "No explanation yet."}
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-widest text-gray-500 font-medium mb-2">URLs</p>
            <div className="space-y-2">
              {(note.source_links || []).length === 0 ? (
                <p className="text-sm text-gray-500">No links saved.</p>
              ) : note.source_links.map((link, idx) => (
                <a key={idx} href={link.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 hover:border-gray-700 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{link.label}</p>
                    <p className="text-xs text-gray-500 truncate">{link.source_type} · {link.url}</p>
                  </div>
                  <ExternalLink size={14} className="text-gray-500 shrink-0" />
                </a>
              ))}
            </div>
          </div>

          {note.tags?.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {note.tags.map(tag => <span key={tag} className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300">#{tag}</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OpsNoteForm({ note, onSaved }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: note?.title || "",
    category: note?.category || "",
    command_snippet: note?.command_snippet || "",
    body: note?.body || "",
    tagsText: (note?.tags || []).join(", "),
    pinned: note?.pinned || false,
    notes_format: note?.notes_format || "markdown",
    status: note?.status || "active",
    source_links: note?.source_links?.length ? note.source_links : [{ label: "", url: "", source_type: "official_docs" }],
  });
  const [error, setError] = useState(null);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        category: form.category || null,
        command_snippet: form.command_snippet || null,
        body: form.body || null,
        tags: form.tagsText.split(",").map(t => t.trim()).filter(Boolean),
        pinned: form.pinned,
        notes_format: form.notes_format,
        status: form.status,
        source_links: form.source_links.filter(link => link.label || link.url || link.source_type),
      };
      return note ? opsNotesApi.update(note.id, payload) : opsNotesApi.create(payload);
    },
    onSuccess: (saved) => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["ops-notes"] });
      onSaved?.(saved);
    },
    onError: (err) => {
      setError(err?.response?.data?.error || err.message || "Failed to save note");
    },
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
      {error && <div className="bg-red-950/50 border border-red-800 rounded-lg px-4 py-2 text-sm text-red-400">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title" className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 outline-none" required />
        <input value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Category (gateway, auth, update...)" className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 outline-none" />
      </div>
      <textarea value={form.command_snippet} onChange={(e) => setForm(f => ({ ...f, command_snippet: e.target.value }))} placeholder="Main command" rows={3} className="w-full bg-gray-950 border border-gray-700 text-white rounded-xl px-4 py-3 outline-none text-lg font-bold" />
      <textarea value={form.body} onChange={(e) => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Explanation / troubleshooting notes / steps that worked before" rows={8} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 outline-none" />
      <input value={form.tagsText} onChange={(e) => setForm(f => ({ ...f, tagsText: e.target.value }))} placeholder="Tags separated by commas" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 outline-none" />
      <div className="grid grid-cols-3 gap-3">
        <select value={form.notes_format} onChange={(e) => setForm(f => ({ ...f, notes_format: e.target.value }))} className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 outline-none">{FORMATS.map(v => <option key={v} value={v}>{v}</option>)}</select>
        <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))} className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 outline-none">{STATUSES.map(v => <option key={v} value={v}>{v}</option>)}</select>
        <label className="flex items-center gap-2 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2"><input type="checkbox" checked={form.pinned} onChange={(e) => setForm(f => ({ ...f, pinned: e.target.checked }))} />Pinned</label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">URLs / references</p>
          <button type="button" onClick={() => setForm(f => ({ ...f, source_links: [...f.source_links, { label: "", url: "", source_type: "official_docs" }] }))} className="text-xs text-orange-400 hover:text-orange-300">+ Add link</button>
        </div>
        {form.source_links.map((link, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2">
            <input value={link.label} onChange={(e) => updateLink(setForm, idx, "label", e.target.value)} placeholder="Label" className="col-span-3 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 outline-none" />
            <input value={link.url} onChange={(e) => updateLink(setForm, idx, "url", e.target.value)} placeholder="https://..." className="col-span-6 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 outline-none" />
            <select value={link.source_type} onChange={(e) => updateLink(setForm, idx, "source_type", e.target.value)} className="col-span-2 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 outline-none">{SOURCE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}</select>
            <button type="button" onClick={() => removeLink(setForm, idx)} className="col-span-1 text-red-400 hover:text-red-300 text-xs">X</button>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button type="submit" className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm px-4 py-2 rounded-lg" disabled={mutation.isPending}>
          <Save size={14} /> {mutation.isPending ? "Saving..." : "Save note"}
        </button>
      </div>
    </form>
  );
}

function updateLink(setForm, idx, field, value) {
  setForm(f => {
    const source_links = [...f.source_links];
    source_links[idx] = { ...source_links[idx], [field]: value };
    return { ...f, source_links };
  });
}

function removeLink(setForm, idx) {
  setForm(f => ({ ...f, source_links: f.source_links.filter((_, i) => i !== idx) }));
}
