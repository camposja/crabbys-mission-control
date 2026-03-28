import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentsApi } from "../../api/documents";
import { FileText, FolderOpen, Check, X, Edit3, Database, Search, Upload, AlertTriangle, Download, ChevronRight, ArrowLeft, Briefcase } from "lucide-react";
import ErrorBoundary from "../../components/ui/ErrorBoundary";

const READ_ONLY_EXTENSIONS = /\.(docx|pdf)$/i;

function DocViewer({ doc, onClose, allowDownload = false }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["doc-content", doc.path],
    queryFn:  () => documentsApi.getContent(doc.path),
    enabled:  !!doc.path,
  });

  const [draft, setDraft] = useState(null);
  // If doc has content directly (database doc), use it; otherwise use fetched data
  const content = draft ?? (doc.content || data?.content || "");

  const save = useMutation({
    mutationFn: () => documentsApi.updateContent(doc.path, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doc-content", doc.path] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      setDraft(null);
    },
  });

  const isMarkdown = doc.path?.endsWith(".md") || doc.name?.endsWith(".md") || doc.title?.endsWith(".md");
  const isReadOnly = !doc.path || READ_ONLY_EXTENSIONS.test(doc.path || doc.name || "");

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
            <>
              {!isReadOnly && (
                <button
                  onClick={() => setDraft(content)}
                  title="Edit"
                  className="text-gray-600 hover:text-orange-400 transition-colors"
                >
                  <Edit3 size={14} />
                </button>
              )}
              {allowDownload && doc.path && /\.(doc|txt)$/i.test(doc.path) && (
                <a
                  href={documentsApi.downloadUrl(doc.path)}
                  download
                  title="Download"
                  className="text-gray-600 hover:text-orange-400 transition-colors"
                >
                  <Download size={14} />
                </a>
              )}
            </>
          )}
          <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors ml-1">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Path */}
      {doc.path && (
        <div className="px-5 py-2 border-b border-gray-800/50 shrink-0 flex items-center gap-2">
          <p className="text-xs text-gray-600 font-mono truncate flex-1">{doc.path}</p>
          {isReadOnly && (
            <span className="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded shrink-0">read-only</span>
          )}
        </div>
      )}

      {/* Content */}
      {isLoading && !doc.content ? (
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

function UploadButton({ onUploaded }) {
  const inputRef = useRef(null);
  const qc = useQueryClient();
  const upload = useMutation({
    mutationFn: (file) => documentsApi.upload(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      onUploaded?.();
    },
  });

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".md,.txt,.json,.yaml,.yml,.csv,.rst"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
        className="flex items-center gap-1.5 text-xs bg-orange-500/20 hover:bg-orange-500/30 disabled:opacity-50 text-orange-400 px-3 py-1.5 rounded-lg transition-colors"
      >
        <Upload size={12} /> {upload.isPending ? "Uploading…" : "Upload"}
      </button>
      {upload.isError && (
        <div className="flex items-center gap-1 text-xs text-red-400 mt-1">
          <AlertTriangle size={11} /> {upload.error?.response?.data?.error || upload.error?.message}
        </div>
      )}
    </>
  );
}

function ResumeBrowser({ selected, onSelect }) {
  const [currentPath, setCurrentPath] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["resumes", currentPath],
    queryFn: () => documentsApi.getResumes(currentPath),
    staleTime: 30_000,
  });

  const folders = data?.folders || [];
  const files = data?.files || [];
  const pathParts = currentPath ? currentPath.split("/") : [];

  const navigateUp = () => {
    if (pathParts.length <= 1) {
      setCurrentPath(null);
    } else {
      setCurrentPath(pathParts.slice(0, -1).join("/"));
    }
  };

  return (
    <div>
      {/* Breadcrumb */}
      {currentPath && (
        <div className="flex items-center gap-1.5 mb-3 text-xs text-gray-500">
          <button onClick={() => setCurrentPath(null)} className="hover:text-white transition-colors">
            resumes
          </button>
          {pathParts.map((part, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <ChevronRight size={10} className="text-gray-700" />
              <button
                onClick={() => setCurrentPath(pathParts.slice(0, i + 1).join("/"))}
                className={`hover:text-white transition-colors ${i === pathParts.length - 1 ? "text-white" : ""}`}
              >
                {part}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Back button */}
      {currentPath && (
        <button
          onClick={navigateUp}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white mb-2 transition-colors"
        >
          <ArrowLeft size={12} /> Back
        </button>
      )}

      {isLoading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : (folders.length === 0 && files.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-600">
          <Briefcase size={36} className="mb-3 opacity-40" />
          <p className="text-sm">No resume files found</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {/* Folders */}
          {folders.map((folder) => (
            <button
              key={folder.path}
              onClick={() => setCurrentPath(folder.path)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-gray-800 border border-transparent transition-colors text-left"
            >
              <FolderOpen size={13} className="text-orange-400 shrink-0" />
              <p className="text-sm text-white">{folder.name}</p>
              <ChevronRight size={12} className="text-gray-700 ml-auto" />
            </button>
          ))}
          {/* Files */}
          {files.map((file) => (
            <button
              key={file.path}
              onClick={() => onSelect(prev => prev?.path === file.path ? null : file)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-left ${
                selected?.path === file.path
                  ? "bg-orange-500/10 border border-orange-500/30"
                  : "hover:bg-gray-800 border border-transparent"
              }`}
            >
              <FileText size={13} className="text-gray-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{file.name}</p>
                <p className="text-xs text-gray-600 font-mono truncate">{file.type.toUpperCase()}</p>
              </div>
              {file.size && (
                <span className="text-xs text-gray-700 shrink-0">
                  {file.size < 1024 ? `${file.size}B` : `${(file.size / 1024).toFixed(1)}KB`}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DocsInner() {
  const [selected,   setSelected]   = useState(null);
  const [activeTab,  setActiveTab]  = useState("workspace");
  const [searchQ,    setSearchQ]    = useState("");
  const [searchSubmit, setSearchSubmit] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn:  documentsApi.getAll,
    staleTime: 30_000,
  });

  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ["docs-search", searchSubmit],
    queryFn:  () => documentsApi.search(searchSubmit),
    enabled:  searchSubmit.length > 1,
  });

  const workspace = data?.workspace || [];
  const database  = data?.database  || [];

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className={`flex-1 flex flex-col overflow-hidden transition-all ${selected ? "mr-[560px]" : ""}`}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-bold text-white">Docs</h1>
            <UploadButton onUploaded={() => setActiveTab("workspace")} />
          </div>
          <p className="text-gray-400 text-sm">
            {workspace.length} workspace file{workspace.length !== 1 ? "s" : ""} · {database.length} database doc{database.length !== 1 ? "s" : ""}
          </p>
          {/* Search bar */}
          <form
            onSubmit={e => { e.preventDefault(); setSearchSubmit(searchQ.trim()); }}
            className="flex gap-2 mt-3"
          >
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                value={searchQ}
                onChange={e => { setSearchQ(e.target.value); if (!e.target.value) setSearchSubmit(""); }}
                placeholder="Search documents…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-orange-500/50 transition-colors"
              />
            </div>
            <button type="submit" disabled={!searchQ.trim()} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-xs px-3 rounded-lg transition-colors">
              Search
            </button>
          </form>
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
              onClick={() => setActiveTab("qr-doorbell")}
              className={`flex items-center gap-1.5 text-sm pb-0.5 transition-colors ${
                activeTab === "qr-doorbell" ? "text-white border-b-2 border-orange-500" : "text-gray-500 hover:text-gray-400"
              }`}
            >
              <Database size={13} /> Mission Control (DB) ({database.length})
            </button>
            <button
              onClick={() => setActiveTab("resumes")}
              className={`flex items-center gap-1.5 text-sm pb-0.5 transition-colors ${
                activeTab === "resumes" ? "text-white border-b-2 border-orange-500" : "text-gray-500 hover:text-gray-400"
              }`}
            >
              <Briefcase size={13} /> Resumes
            </button>
          </div>

          {/* Search results */}
          {searchSubmit && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-400">Results for "<span className="text-white">{searchSubmit}</span>"</p>
                <button onClick={() => { setSearchSubmit(""); setSearchQ(""); }} className="text-xs text-gray-600 hover:text-white">Clear</button>
              </div>
              {searching ? (
                <p className="text-gray-500 text-sm">Searching…</p>
              ) : (
                <>
                  {searchResults?.files?.map((f, i) => (
                    <button key={i} onClick={() => setSelected(f)} className="w-full text-left bg-gray-900 border border-gray-800 rounded-lg p-3 mb-2 hover:border-gray-700 transition-colors">
                      <p className="text-xs text-orange-400 truncate mb-1">{f.path}</p>
                      <p className="text-xs text-gray-400 font-mono">{f.snippet}</p>
                    </button>
                  ))}
                  {searchResults?.db?.map((d, i) => (
                    <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-3 mb-2">
                      <p className="text-sm text-white">{d.title || d.filename}</p>
                    </div>
                  ))}
                  {(searchResults?.files?.length === 0 && searchResults?.db?.length === 0) && (
                    <p className="text-gray-600 text-sm">No results.</p>
                  )}
                </>
              )}
            </div>
          )}

          {isLoading && activeTab !== "resumes" ? (
            <p className="text-gray-500 text-sm">Loading…</p>
          ) : activeTab === "resumes" ? (
            <ResumeBrowser selected={selected} onSelect={setSelected} />
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
          ) : activeTab === "qr-doorbell" ? (
            database.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                <Database size={36} className="mb-3 opacity-40" />
                <p className="text-sm">No Mission Control documents yet</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {/* Group by folder */}
                {(() => {
                  const folders = {};
                  const topLevel = [];
                  
                  database.forEach((doc) => {
                    if (doc.folder) {
                      if (!folders[doc.folder]) folders[doc.folder] = [];
                      folders[doc.folder].push(doc);
                    } else {
                      topLevel.push(doc);
                    }
                  });

                  return (
                    <>
                      {Object.keys(folders).sort().map((folderName) => (
                        <div key={folderName} className="mb-3">
                          <div className="flex items-center gap-2 px-3 py-1.5 mb-1">
                            <FolderOpen size={13} className="text-orange-400" />
                            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">{folderName}</p>
                          </div>
                          {folders[folderName].map((doc, i) => (
                            <button
                              key={doc.id || doc.path || i}
                              onClick={() => setSelected(doc.path ? doc : { ...doc, path: null, name: doc.title || doc.filename })}
                              className={`w-full flex items-center gap-3 px-3 pl-8 py-2.5 rounded-md transition-colors text-left ${
                                selected?.path === doc.path || selected?.id === doc.id
                                  ? "bg-orange-500/10 border border-orange-500/30"
                                  : "bg-gray-900 border border-gray-800 hover:border-gray-700"
                              }`}
                            >
                              <FileText size={13} className="text-gray-600 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white font-medium truncate">{doc.name?.split('/').pop() || doc.title || doc.filename}</p>
                                {doc.content && (
                                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                    {doc.content.substring(0, 150)}...
                                  </p>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      ))}
                      
                      {topLevel.map((doc, i) => (
                        <button
                          key={doc.id || i}
                          onClick={() => setSelected({ ...doc, path: null, name: doc.title || doc.filename })}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-left ${
                            selected?.id === doc.id
                              ? "bg-orange-500/10 border border-orange-500/30"
                              : "bg-gray-900 border border-gray-800 hover:border-gray-700"
                          }`}
                        >
                          <FileText size={13} className="text-gray-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium truncate">{doc.title || doc.filename || `Document ${doc.id}`}</p>
                            {doc.content && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                {doc.content.substring(0, 150)}...
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </>
                  );
                })()}
              </div>
            )
          ) : null}
        </div>
      </div>

      {selected && (
        <DocViewer
          doc={selected}
          onClose={() => setSelected(null)}
          allowDownload={activeTab === "resumes"}
        />
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
