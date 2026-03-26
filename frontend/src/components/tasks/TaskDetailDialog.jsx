import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, Send, CheckCircle, FileText, Paperclip, Trash2, Upload,
  Clock, User, Bot, ShieldCheck,
} from "lucide-react";
import { tasksApi } from "../../api/tasks";
import { taskNotesApi, taskAttachmentsApi, taskApproveApi } from "../../api/taskNotes";
import { cn } from "../../lib/utils";
import ReactMarkdown from "react-markdown";

const STATUS_LABELS = {
  backlog: "Backlog", recurring: "Recurring", in_progress: "In Progress",
  review: "Review", done: "Done",
};
const STATUS_COLORS = {
  backlog: "bg-gray-500/20 text-gray-400", recurring: "bg-purple-500/20 text-purple-400",
  in_progress: "bg-blue-500/20 text-blue-400", review: "bg-yellow-500/20 text-yellow-400",
  done: "bg-green-500/20 text-green-400",
};

function relativeTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function TaskDetailDialog({ taskId, open, onClose }) {
  const qc = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [showAttachForm, setShowAttachForm] = useState(false);
  const [attachFilename, setAttachFilename] = useState("");
  const [attachContent, setAttachContent] = useState("");

  const { data: task, isLoading } = useQuery({
    queryKey: ["task-detail", taskId],
    queryFn: () => tasksApi.get(taskId),
    enabled: open && !!taskId,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["task-detail", taskId] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const addNoteMutation = useMutation({
    mutationFn: () => taskNotesApi.create(taskId, { author: "jose", body: noteText }),
    onSuccess: () => { setNoteText(""); invalidateAll(); },
  });

  const approveMutation = useMutation({
    mutationFn: () => taskApproveApi.approve(taskId, {
      approved_by: "jose",
      note: approveNote || null,
    }),
    onSuccess: () => { setApproveNote(""); invalidateAll(); },
  });

  const addAttachMutation = useMutation({
    mutationFn: () => taskAttachmentsApi.create(taskId, {
      filename: attachFilename,
      content: attachContent,
      uploaded_by: "jose",
    }),
    onSuccess: () => { setAttachFilename(""); setAttachContent(""); setShowAttachForm(false); invalidateAll(); },
  });

  const deleteAttachMutation = useMutation({
    mutationFn: (id) => taskAttachmentsApi.destroy(taskId, id),
    onSuccess: invalidateAll,
  });

  if (!open) return null;

  const notes = task?.notes || [];
  const attachments = task?.attachments || [];
  const isReview = task?.status === "review";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        {isLoading ? (
          <div className="p-6 text-gray-400 text-sm">Loading...</div>
        ) : task ? (
          <>
            <div className="px-6 py-5 border-b border-gray-800 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("text-xs px-2 py-0.5 rounded", STATUS_COLORS[task.status])}>
                    {STATUS_LABELS[task.status] || task.status}
                  </span>
                  {task.priority && task.priority !== "medium" && (
                    <span className="text-xs text-gray-500">{task.priority}</span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-white">{task.title}</h2>
                {task.description && (
                  <p className="text-sm text-gray-400 mt-1">{task.description}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                  {task.assignee && <span>Assigned: {task.assignee}</span>}
                  {task.due_date && <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>}
                  {task.approved_by && <span className="text-green-400">✓ Approved by {task.approved_by}</span>}
                </div>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors shrink-0">
                <X size={18} />
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* Review approval banner */}
              {isReview && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck size={16} className="text-yellow-400" />
                    <p className="text-sm font-medium text-yellow-400">Ready for Review</p>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">Review the notes below and approve to move this task to Done.</p>
                  <textarea
                    value={approveNote}
                    onChange={(e) => setApproveNote(e.target.value)}
                    placeholder="Optional review note..."
                    rows={2}
                    className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-yellow-500/50 mb-3 resize-none"
                  />
                  <button
                    onClick={() => approveMutation.mutate()}
                    disabled={approveMutation.isPending}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                  >
                    <CheckCircle size={14} />
                    {approveMutation.isPending ? "Approving..." : "Approve & Move to Done"}
                  </button>
                </div>
              )}

              {/* Notes */}
              <div>
                <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-3">Notes & Work Summary</h3>
                {notes.length === 0 ? (
                  <p className="text-sm text-gray-700">No notes yet.</p>
                ) : (
                  <div className="space-y-2">
                    {notes.map(note => (
                      <div key={note.id} className="bg-gray-800 border border-gray-700/50 rounded-lg px-4 py-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          {note.author === "crabby" ? (
                            <Bot size={12} className="text-orange-400" />
                          ) : (
                            <User size={12} className="text-blue-400" />
                          )}
                          <span className="text-xs font-medium text-gray-300">{note.author}</span>
                          <span className="text-xs text-gray-600">{relativeTime(note.created_at)}</span>
                        </div>
                        <div className="text-sm text-gray-200 prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{note.body}</ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add note */}
                <div className="flex gap-2 mt-3">
                  <input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note..."
                    className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-orange-500/50"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && noteText.trim()) {
                        e.preventDefault();
                        addNoteMutation.mutate();
                      }
                    }}
                  />
                  <button
                    onClick={() => addNoteMutation.mutate()}
                    disabled={!noteText.trim() || addNoteMutation.isPending}
                    className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-3 py-2 rounded-lg transition-colors"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>

              {/* Attachments */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs text-gray-500 uppercase tracking-wide">Attachments (.txt, .md only)</h3>
                  <button
                    onClick={() => setShowAttachForm(v => !v)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-orange-400 transition-colors"
                  >
                    <Upload size={12} /> {showAttachForm ? "Cancel" : "Add file"}
                  </button>
                </div>

                {showAttachForm && (
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-3 space-y-2">
                    <input
                      value={attachFilename}
                      onChange={(e) => setAttachFilename(e.target.value)}
                      placeholder="filename.txt or filename.md"
                      className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded px-3 py-1.5 outline-none"
                    />
                    <textarea
                      value={attachContent}
                      onChange={(e) => setAttachContent(e.target.value)}
                      placeholder="File content..."
                      rows={4}
                      className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded px-3 py-2 outline-none resize-none font-mono"
                    />
                    <button
                      onClick={() => addAttachMutation.mutate()}
                      disabled={!attachFilename.trim() || !attachContent.trim() || addAttachMutation.isPending}
                      className="text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-3 py-1.5 rounded transition-colors"
                    >
                      {addAttachMutation.isPending ? "Uploading..." : "Attach"}
                    </button>
                  </div>
                )}

                {attachments.length === 0 && !showAttachForm ? (
                  <p className="text-sm text-gray-700">No attachments.</p>
                ) : (
                  <div className="space-y-1">
                    {attachments.map(att => (
                      <div key={att.id} className="flex items-center gap-3 bg-gray-800 border border-gray-700/50 rounded-lg px-4 py-2.5 group">
                        <FileText size={14} className="text-gray-500 shrink-0" />
                        <span className="flex-1 text-sm text-gray-300 font-mono truncate">{att.filename}</span>
                        <span className="text-xs text-gray-600">{relativeTime(att.created_at)}</span>
                        <button
                          onClick={() => deleteAttachMutation.mutate(att.id)}
                          className="text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="p-6 text-red-400 text-sm">Task not found.</div>
        )}
      </div>
    </div>
  );
}
