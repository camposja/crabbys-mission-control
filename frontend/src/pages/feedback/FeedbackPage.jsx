import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { feedbacksApi } from "../../api/feedbacks";
import { useChannel } from "../../hooks/useChannel";
import {
  MessageSquarePlus, CheckCircle2, Clock, AlertCircle,
  Loader2, ChevronDown, ChevronUp, GitBranch, Sparkles,
  Bug, Zap, TrendingUp, HelpCircle,
} from "lucide-react";
import ErrorBoundary from "../../components/ui/ErrorBoundary";

const TYPE_CONFIG = {
  bug:         { icon: Bug,         color: "text-red-400",    bg: "bg-red-500/10    border-red-500/20",    label: "Bug"         },
  feature:     { icon: Sparkles,    color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", label: "Feature"     },
  improvement: { icon: TrendingUp,  color: "text-blue-400",   bg: "bg-blue-500/10   border-blue-500/20",   label: "Improvement" },
  question:    { icon: HelpCircle,  color: "text-gray-400",   bg: "bg-gray-800      border-gray-700",      label: "Question"    },
};

const STATUS_CONFIG = {
  pending:    { icon: Clock,         color: "text-gray-400",   label: "Pending"    },
  processing: { icon: Loader2,       color: "text-yellow-400", label: "Processing" },
  done:       { icon: CheckCircle2,  color: "text-green-400",  label: "Done"       },
  failed:     { icon: AlertCircle,   color: "text-red-400",    label: "Failed"     },
};

function FeedbackCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const typeCfg   = TYPE_CONFIG[item.feedback_type]  || TYPE_CONFIG.feature;
  const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
  const TypeIcon   = typeCfg.icon;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors">
      <div
        className="flex items-start gap-3 px-4 py-3.5 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className={`mt-0.5 p-1.5 rounded-lg border shrink-0 ${typeCfg.bg}`}>
          <TypeIcon size={13} className={typeCfg.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-medium text-white truncate">{item.title}</p>
          </div>
          <p className="text-xs text-gray-500 line-clamp-1">{item.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusIcon
            size={13}
            className={`${statusCfg.color} ${item.status === "processing" ? "animate-spin" : ""}`}
          />
          <span className="text-xs text-gray-500">{statusCfg.label}</span>
          {expanded ? <ChevronUp size={13} className="text-gray-600" /> : <ChevronDown size={13} className="text-gray-600" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-3">
          {item.description && (
            <p className="text-sm text-gray-300 leading-relaxed">{item.description}</p>
          )}

          {item.branch_name && (
            <div className="flex items-center gap-2">
              <GitBranch size={12} className="text-orange-400" />
              <code className="text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded font-mono">
                {item.branch_name}
              </code>
            </div>
          )}

          {item.ai_response && (
            <div className="bg-gray-800/80 rounded-lg p-3">
              <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-2">
                <Sparkles size={11} className="text-purple-400" /> OpenClaw Response
              </p>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{item.ai_response}</p>
            </div>
          )}

          <p className="text-xs text-gray-700">
            Submitted {new Date(item.created_at).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}

function SubmitForm({ onSuccess }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "", description: "", feedback_type: "feature"
  });

  const submit = useMutation({
    mutationFn: () => feedbacksApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feedbacks"] });
      setForm({ title: "", description: "", feedback_type: "feature" });
      onSuccess?.();
    },
  });

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
        <MessageSquarePlus size={14} className="text-orange-400" /> Submit Feedback
      </h2>

      {/* Type selector */}
      <div className="flex gap-2">
        {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
          const Icon = cfg.icon;
          return (
            <button
              key={type}
              onClick={() => setForm(f => ({ ...f, feedback_type: type }))}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                form.feedback_type === type ? `${cfg.bg} ${cfg.color}` : "border-gray-700 text-gray-500 hover:border-gray-600"
              }`}
            >
              <Icon size={11} /> {cfg.label}
            </button>
          );
        })}
      </div>

      <input
        value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        placeholder="Title (required)"
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-orange-500/50 transition-colors"
      />

      <textarea
        value={form.description}
        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        placeholder="Describe the bug, feature, or question in detail…"
        rows={4}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-orange-500/50 transition-colors resize-none"
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-600">
          OpenClaw will analyse this and suggest an implementation approach.
        </p>
        <button
          onClick={() => submit.mutate()}
          disabled={submit.isPending || !form.title.trim()}
          className="flex items-center gap-2 text-sm bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg transition-colors"
        >
          {submit.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {submit.isPending ? "Submitting…" : "Submit"}
        </button>
      </div>

      {submit.isError && (
        <p className="text-xs text-red-400">{submit.error?.message || "Failed to submit"}</p>
      )}
    </div>
  );
}

function FeedbackInner() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["feedbacks"],
    queryFn:  feedbacksApi.getAll,
    staleTime: 30_000,
  });

  useChannel("AgentEventsChannel", (msg) => {
    if (msg?.event === "feedback_updated") {
      qc.invalidateQueries({ queryKey: ["feedbacks"] });
    }
  });

  const feedbacks = data || [];
  const pending   = feedbacks.filter(f => f.status === "pending" || f.status === "processing").length;
  const done      = feedbacks.filter(f => f.status === "done").length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 pt-6 pb-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Feedback</h1>
            <p className="text-gray-400 text-sm">
              {feedbacks.length} items · {pending} processing · {done} done
            </p>
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 text-sm bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 px-3 py-2 rounded-lg transition-colors"
          >
            <MessageSquarePlus size={14} />
            {showForm ? "Hide form" : "New feedback"}
          </button>
        </div>
      </div>

      <div className="px-6 py-6 space-y-5">
        {showForm && (
          <SubmitForm onSuccess={() => setShowForm(false)} />
        )}

        {isLoading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : feedbacks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600">
            <MessageSquarePlus size={36} className="mb-3 opacity-40" />
            <p className="text-sm">No feedback submitted yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {feedbacks.map(f => (
              <FeedbackCard key={f.id} item={f} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <ErrorBoundary>
      <FeedbackInner />
    </ErrorBoundary>
  );
}
