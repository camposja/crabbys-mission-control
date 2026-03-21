import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { memoriesApi } from "../../api/memories";
import { useChannel } from "../../hooks/useChannel";
import {
  Brain, Search, FileText, Database, Edit3, Check, X,
  ChevronRight, Tag, Clock,
} from "lucide-react";
import ErrorBoundary from "../../components/ui/ErrorBoundary";

function JournalEditor({ file, onClose }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["journal", file.path],
    queryFn:  () => memoriesApi.getJournal(file.path),
  });

  const [draft, setDraft] = useState(null);
  const content = draft ?? (data?.content || "");

  const save = useMutation({
    mutationFn: () => memoriesApi.updateJournal(file.path, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal", file.path] });
      qc.invalidateQueries({ queryKey: ["memories"] });
      setDraft(null);
    },
  });

  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-gray-900 border-l border-gray-800 z-40 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={14} className="text-orange-400 shrink-0" />
          <p className="text-sm font-medium text-white truncate">{file.name || file.path.split("/").pop()}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {draft !== null && (
            <>
              <button
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="flex items-center gap-1 text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-2.5 py-1 rounded transition-colors"
              >
                <Check size={11} /> {save.isPending ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setDraft(null)}
                className="text-xs text-gray-500 hover:text-white px-2 py-1 transition-colors"
              >
                <X size={11} />
              </button>
            </>
          )}
          <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors ml-1">
            <X size={16} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">Loading…</div>
      ) : (
        <textarea
          value={content}
          onChange={e => setDraft(e.target.value)}
          className="flex-1 bg-transparent text-sm text-gray-300 font-mono p-5 resize-none outline-none leading-relaxed"
          spellCheck={false}
        />
      )}
    </div>
  );
}

function DbMemoryCard({ memory }) {
  const [expanded, setExpanded] = useState(false);
  const preview = memory.content?.slice(0, 140);
  const long = memory.content?.length > 140;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {memory.memory_type && (
            <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded capitalize">
              {memory.memory_type}
            </span>
          )}
          {memory.agent_id && (
            <span className="text-xs bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">
              {memory.agent_id}
            </span>
          )}
        </div>
        {memory.date && (
          <div className="flex items-center gap-1 text-xs text-gray-600 shrink-0">
            <Clock size={10} />
            {new Date(memory.date).toLocaleDateString()}
          </div>
        )}
      </div>

      <p className="text-sm text-gray-300 leading-relaxed">
        {expanded ? memory.content : preview}
        {long && !expanded && "…"}
      </p>

      {long && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-xs text-gray-600 hover:text-orange-400 mt-1.5 transition-colors"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}

      {memory.tags && (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <Tag size={10} className="text-gray-600" />
          {(Array.isArray(memory.tags) ? memory.tags : [memory.tags]).map((t, i) => (
            <span key={i} className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchResults({ results }) {
  const { db = [], files = [] } = results;

  return (
    <div className="space-y-4">
      {db.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Database size={11} /> Database ({db.length})
          </p>
          <div className="space-y-2">
            {db.map((m, i) => <DbMemoryCard key={m.id || i} memory={m} />)}
          </div>
        </div>
      )}
      {files.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <FileText size={11} /> Files ({files.length})
          </p>
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                <p className="text-xs text-orange-400 truncate mb-1">{f.path}</p>
                <p className="text-sm text-gray-400 font-mono leading-relaxed">{f.snippet}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {db.length === 0 && files.length === 0 && (
        <p className="text-sm text-gray-600 text-center py-8">No results found.</p>
      )}
    </div>
  );
}

function MemoryInner() {
  const qc  = useQueryClient();
  const [q, setQ] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeTab, setActiveTab] = useState("db"); // "db" | "journals"
  const inputRef = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ["memories"],
    queryFn:  () => memoriesApi.getAll(),
    staleTime: 30_000,
  });

  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ["memories-search", searchQuery],
    queryFn:  () => memoriesApi.search(searchQuery),
    enabled:  searchQuery.length > 1,
  });

  useChannel("AgentEventsChannel", (msg) => {
    if (msg?.event === "memory_updated") {
      qc.invalidateQueries({ queryKey: ["memories"] });
    }
  });

  const memories  = data?.memories || [];
  const journals  = data?.journals  || [];

  function handleSearch(e) {
    e.preventDefault();
    setSearchQuery(q.trim());
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className={`flex-1 flex flex-col overflow-hidden transition-all ${selectedFile ? "mr-[520px]" : ""}`}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-800 shrink-0">
          <h1 className="text-2xl font-bold text-white mb-1">Memory</h1>
          <p className="text-gray-400 text-sm">
            {memories.length} records · {journals.length} journal file{journals.length !== 1 ? "s" : ""}
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex gap-2 mt-4">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                ref={inputRef}
                value={q}
                onChange={e => { setQ(e.target.value); if (!e.target.value) setSearchQuery(""); }}
                placeholder="Search memories and journals…"
                className="w-full bg-gray-800 border border-gray-700 rounded-md pl-9 pr-4 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-orange-500/50 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={!q.trim()}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm px-4 rounded-md transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {searching && (
            <p className="text-gray-500 text-sm">Searching…</p>
          )}

          {searchQuery && searchResults ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-400">
                  Results for <span className="text-white font-medium">"{searchQuery}"</span>
                </p>
                <button
                  onClick={() => { setSearchQuery(""); setQ(""); }}
                  className="text-xs text-gray-600 hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>
              <SearchResults results={searchResults} />
            </>
          ) : isLoading ? (
            <p className="text-gray-500 text-sm">Loading…</p>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-4 mb-4 border-b border-gray-800 pb-3">
                <button
                  onClick={() => setActiveTab("db")}
                  className={`flex items-center gap-1.5 text-sm pb-0.5 transition-colors ${
                    activeTab === "db" ? "text-white border-b-2 border-orange-500" : "text-gray-500 hover:text-gray-400"
                  }`}
                >
                  <Database size={13} /> DB Memories ({memories.length})
                </button>
                <button
                  onClick={() => setActiveTab("journals")}
                  className={`flex items-center gap-1.5 text-sm pb-0.5 transition-colors ${
                    activeTab === "journals" ? "text-white border-b-2 border-orange-500" : "text-gray-500 hover:text-gray-400"
                  }`}
                >
                  <FileText size={13} /> Journal Files ({journals.length})
                </button>
              </div>

              {activeTab === "db" && (
                <div className="space-y-2">
                  {memories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                      <Brain size={32} className="mb-3 opacity-40" />
                      <p className="text-sm">No memories yet</p>
                    </div>
                  ) : (
                    memories.map((m, i) => <DbMemoryCard key={m.id || i} memory={m} />)
                  )}
                </div>
              )}

              {activeTab === "journals" && (
                <div className="space-y-1">
                  {journals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                      <FileText size={32} className="mb-3 opacity-40" />
                      <p className="text-sm">No journal files found in ~/.openclaw</p>
                    </div>
                  ) : (
                    journals.map((f, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedFile(prev => prev?.path === f.path ? null : f)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-left ${
                          selectedFile?.path === f.path
                            ? "bg-orange-500/10 border border-orange-500/30"
                            : "hover:bg-gray-800 border border-transparent"
                        }`}
                      >
                        <FileText size={13} className="text-gray-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{f.name || f.path.split("/").pop()}</p>
                          <p className="text-xs text-gray-600 truncate">{f.path}</p>
                        </div>
                        <ChevronRight size={13} className="text-gray-700 shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Journal editor panel */}
      {selectedFile && (
        <JournalEditor file={selectedFile} onClose={() => setSelectedFile(null)} />
      )}
    </div>
  );
}

export default function MemoryPage() {
  return (
    <ErrorBoundary>
      <MemoryInner />
    </ErrorBoundary>
  );
}
