import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Check, X, Target } from "lucide-react";
import { dashboardApi } from "../../api/dashboard";

export default function MissionStatement({ content }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(content || "");

  const mutation = useMutation({
    mutationFn: dashboardApi.updateMissionStatement,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mission-statement"] });
      setEditing(false);
    },
  });

  // Nothing set yet — show a prompt
  if (!content && !editing) {
    return (
      <button
        onClick={() => { setDraft(""); setEditing(true); }}
        className="w-full text-left bg-gray-900 border border-dashed border-gray-700 rounded-lg px-5 py-4 hover:border-orange-500/50 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <Target size={14} className="text-gray-600 group-hover:text-orange-400 transition-colors" />
          <p className="text-sm text-gray-600 group-hover:text-gray-400 transition-colors">
            Set your North Star mission statement…
          </p>
        </div>
      </button>
    );
  }

  if (editing) {
    return (
      <div className="bg-orange-500/10 border border-orange-500/40 rounded-lg px-5 py-4">
        <div className="flex items-center gap-2 mb-2">
          <Target size={14} className="text-orange-400" />
          <p className="text-xs text-orange-400 uppercase tracking-widest font-medium">North Star</p>
        </div>
        <textarea
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={2}
          className="w-full bg-transparent text-white text-sm leading-relaxed resize-none outline-none placeholder-gray-600"
          placeholder="What is your mission? e.g. Build a profitable indie product in 90 days…"
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => mutation.mutate(draft)}
            disabled={mutation.isPending || !draft.trim()}
            className="flex items-center gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-1.5 rounded transition-colors"
          >
            <Check size={11} />
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => { setEditing(false); setDraft(content || ""); }}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white px-2 py-1.5 transition-colors"
          >
            <X size={11} /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-5 py-4 group relative">
      <div className="flex items-center gap-2 mb-1">
        <Target size={14} className="text-orange-400" />
        <p className="text-xs text-orange-400 uppercase tracking-widest font-medium">North Star</p>
      </div>
      <p className="text-white text-sm leading-relaxed pr-8">{content}</p>
      <button
        onClick={() => { setDraft(content); setEditing(true); }}
        className="absolute top-4 right-4 text-gray-600 hover:text-orange-400 transition-colors opacity-0 group-hover:opacity-100"
      >
        <Pencil size={13} />
      </button>
    </div>
  );
}
