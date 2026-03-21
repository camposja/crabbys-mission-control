import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentsApi } from "../../api/documents";
import { FileText, FolderOpen, Check, X, Edit3, Database } from "lucide-react";
import ErrorBoundary from "../../components/ui/ErrorBoundary";

function DocViewer({ doc, onClose }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["doc-content", doc.path],
    queryFn:  () => documentsApi.getContent(doc.path),
    enabled:  !!doc.path,
  });

  const [draft, setDraft] = useState(null);
  const content = draft ?? (data?.content || "");

  const save = useMutation({
    mutationFn: () => documentsApi.updateContent(doc.path, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doc-content", doc.path] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      setDraft(null);
    },
  });

  const isMarkdown = doc.path?.endsWith(".md") || doc.name?.endsWith(".md");

  return (
    <div className="fixed inset-y-0 right-0 w-[560px] bg-gray-900 border-l border-gray-800 z-40 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={14} className="text-orange-400 shrink-0" />
          <p className="text-sm font-medium text-white truncate">
            {doc.name || doc.path?.split("/").pop() || doc.title || "Document"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {draft !== null ? (
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
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setDraft(content)}
              title="Edit"
              className="text-gray-600 hover:text-orange-400 transition-colors"
            >
              <Edit3 size={14} />
            </button>
          )}
          <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors ml-1">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Path */}
      <div className="px-5 py-2 border-b border-gray-800/50 shrink-0">
        <p className="text-xs text-gray-600 font-mono truncate">{doc.path}</p>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">Loading…</div>
      ) : draft !== null ? (
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          className="flex-1 bg-transparent text-sm text-gray-300 font-mono p-5 resize-none outline-none leading-relaxed"
          spellCheck={false}
          autoFocus
        />
      ) : (
        <div className="flex-1 overflow-y-auto p-5">
          {isMarkdown ? (
            <pre className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">{content}</pre>
          ) : (
            <pre className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">{content}</pre>
          )}
        </div>
      )}
    </div>
  );
}

function WorkspaceDocList({ docs, selected, onSelect }) {
  return (
    <div className="space-y-0.5">
      {docs.map((doc, i) => (
        <button
          key={i}
          onClick={() => onSelect(prev => prev?.path === doc.path ? null : doc)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-left ${
            selected?.path === doc.path
              ? "bg-orange-500/10 border border-orange-500/30"
              : "hover:bg-gray-800 border border-transparent"
          }`}
        >
          <FileText size={13} className="text-gray-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">
              {doc.name || doc.path?.split("/").pop()}
            </p>
            {doc.path && (
              <p className="text-xs text-gray-600 truncate font-mono">{doc.path}</p>
            )}
          </div>
          {doc.size && (
            <span className="text-xs text-gray-700 shrink-0">
              {doc.size < 1024 ? `${doc.size}B` : `${(doc.size / 1024).toFixed(1)}KB`}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function DocsInner() {
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("workspace");

  const { data, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn:  documentsApi.getAll,
    staleTime: 30_000,
  });

  const workspace = data?.workspace || [];
  const database  = data?.database  || [];

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className={`flex-1 flex flex-col overflow-hidden transition-all ${selected ? "mr-[560px]" : ""}`}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-800 shrink-0">
          <h1 className="text-2xl font-bold text-white mb-1">Docs</h1>
          <p className="text-gray-400 text-sm">
            {workspace.length} workspace file{workspace.length !== 1 ? "s" : ""} · {database.length} database doc{database.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Tabs */}
          <div className="flex gap-4 mb-4 border-b border-gray-800 pb-3">
            <button
              onClick={() => setActiveTab("workspace")}
              className={`flex items-center gap-1.5 text-sm pb-0.5 transition-colors ${
                activeTab === "workspace" ? "text-white border-b-2 border-orange-500" : "text-gray-500 hover:text-gray-400"
              }`}
            >
              <FolderOpen size={13} /> Workspace ({workspace.length})
            </button>
            <button
              onClick={() => setActiveTab("database")}
              className={`flex items-center gap-1.5 text-sm pb-0.5 transition-colors ${
                activeTab === "database" ? "text-white border-b-2 border-orange-500" : "text-gray-500 hover:text-gray-400"
              }`}
            >
              <Database size={13} /> Database ({database.length})
            </button>
          </div>

          {isLoading ? (
            <p className="text-gray-500 text-sm">Loading…</p>
          ) : activeTab === "workspace" ? (
            workspace.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                <FolderOpen size={36} className="mb-3 opacity-40" />
                <p className="text-sm">No workspace documents found</p>
                <p className="text-xs mt-1">Add files to ~/.openclaw/workspace/</p>
              </div>
            ) : (
              <WorkspaceDocList docs={workspace} selected={selected} onSelect={setSelected} />
            )
          ) : (
            database.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                <Database size={36} className="mb-3 opacity-40" />
                <p className="text-sm">No database documents yet</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {database.map((doc, i) => (
                  <div key={doc.id || i} className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-gray-900 border border-gray-800">
                    <FileText size={13} className="text-gray-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{doc.title || doc.filename || `Document ${doc.id}`}</p>
                      {doc.document_type && (
                        <p className="text-xs text-gray-600">{doc.document_type}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {selected && (
        <DocViewer doc={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

export default function DocsPage() {
  return (
    <ErrorBoundary>
      <DocsInner />
    </ErrorBoundary>
  );
}
