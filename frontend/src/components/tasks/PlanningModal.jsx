import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, Loader2, CheckCircle, ChevronRight, Bot } from "lucide-react";
import { tasksApi } from "../../api/tasks";
import { cn } from "../../lib/utils";

const STEPS = { QUESTIONS: "questions", PLAN: "plan", DONE: "done" };

export default function PlanningModal({ task, onApproved, onSkip, onClose }) {
  const [step, setStep] = useState(STEPS.QUESTIONS);
  const [answers, setAnswers] = useState([]);
  const [plan, setPlan] = useState("");
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState(null);

  // Step 1: fetch clarifying questions
  const questionsMutation = useMutation({
    mutationFn: () => tasksApi.getPlan(task.id),
    onSuccess: (data) => {
      setError(null);
      setQuestions(data.questions || []);
      setAnswers(Array(data.questions?.length || 0).fill(""));
    },
    onError: (err) => {
      setError(err?.response?.data?.error || err.message || "Failed to generate clarifying questions.");
    },
  });

  // Step 2: submit answers, get plan
  const planMutation = useMutation({
    mutationFn: () => tasksApi.getPlan(task.id, answers),
    onSuccess: (data) => {
      setError(null);
      setPlan(data.plan || "");
      setStep(STEPS.PLAN);
    },
    onError: (err) => {
      setError(err?.response?.data?.error || err.message || "Failed to generate plan.");
    },
  });

  // Step 3: approve plan (with or without spawning an agent)
  const [doneMessage, setDoneMessage] = useState("Plan approved!");

  const approveMutation = useMutation({
    mutationFn: ({ spawn = false } = {}) => tasksApi.approvePlan(task.id, plan, spawn),
    onSuccess: (data) => {
      setError(null);
      setDoneMessage(data.message || "Plan approved!");
      setStep(STEPS.DONE);
      setTimeout(() => onApproved?.(), 1200);
    },
    onError: (err) => {
      setError(err?.response?.data?.error || err.message || "Failed to approve plan.");
    },
  });

  useEffect(() => {
    setStep(STEPS.QUESTIONS);
    setQuestions([]);
    setAnswers([]);
    setPlan("");
    setError(null);
    questionsMutation.reset();
    planMutation.reset();
    approveMutation.reset();
    questionsMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-start gap-3">
          <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
            <Bot size={15} className="text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-orange-400 uppercase tracking-widest font-medium">Planning Mode</p>
            <p className="text-white font-semibold mt-0.5 truncate">{task.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {error && (
            <div className="mb-4 flex items-center gap-2 bg-red-950/50 border border-red-800 rounded-lg px-4 py-2.5">
              <p className="text-sm text-red-400 flex-1">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  if (step === STEPS.QUESTIONS) questionsMutation.mutate();
                  if (step === STEPS.PLAN) planMutation.mutate();
                }}
                className="text-xs text-red-300 hover:text-white transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading questions */}
          {questionsMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 size={24} className="text-orange-400 animate-spin" />
              <p className="text-sm text-gray-400">Generating clarifying questions…</p>
            </div>
          )}

          {/* Questions step */}
          {step === STEPS.QUESTIONS && questions.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Answer these questions so Crabby can build the best plan:
              </p>
              {questions.map((q, i) => (
                <div key={i}>
                  <label className="text-xs text-gray-400 mb-1 block">
                    {i + 1}. {q}
                  </label>
                  <input
                    value={answers[i] || ""}
                    onChange={e => {
                      const next = [...answers];
                      next[i] = e.target.value;
                      setAnswers(next);
                    }}
                    placeholder="Your answer…"
                    className="w-full bg-gray-800 border border-gray-700 focus:border-orange-500/50 text-white text-sm rounded px-3 py-2 outline-none"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Generating plan */}
          {planMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 size={24} className="text-orange-400 animate-spin" />
              <p className="text-sm text-gray-400">Synthesising your plan…</p>
            </div>
          )}

          {/* Plan review step */}
          {step === STEPS.PLAN && !planMutation.isPending && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">Review and edit the plan before approving:</p>
              <textarea
                value={plan}
                onChange={e => setPlan(e.target.value)}
                rows={10}
                className="w-full bg-gray-800 border border-gray-700 focus:border-orange-500/50 text-white text-sm rounded px-3 py-2.5 outline-none resize-none font-mono leading-relaxed"
              />
              <p className="text-xs text-gray-600">
                You can edit the plan above. Choose to assign directly to Crabby or optionally spawn a sub-agent.
              </p>
            </div>
          )}

          {/* Done */}
          {step === STEPS.DONE && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <CheckCircle size={32} className="text-green-400" />
              <p className="text-white font-medium">{doneMessage}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {step !== STEPS.DONE && (
          <div className="px-5 py-4 border-t border-gray-800 flex items-center justify-between gap-3">
            <button
              onClick={onSkip}
              className="text-xs text-gray-500 hover:text-white transition-colors"
            >
              Skip planning
            </button>

            <div className="flex gap-2">
              {step === STEPS.QUESTIONS && questions.length > 0 && (
                <button
                  onClick={() => planMutation.mutate()}
                  disabled={planMutation.isPending}
                  className={cn(
                    "flex items-center gap-1.5 text-sm px-4 py-2 rounded-md font-medium transition-colors",
                    "bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
                  )}
                >
                  {planMutation.isPending
                    ? <><Loader2 size={13} className="animate-spin" /> Generating…</>
                    : <><ChevronRight size={13} /> Generate Plan</>
                  }
                </button>
              )}

              {step === STEPS.PLAN && (
                <>
                  <button
                    onClick={() => approveMutation.mutate({ spawn: false })}
                    disabled={approveMutation.isPending || !plan.trim()}
                    className={cn(
                      "flex items-center gap-1.5 text-sm px-4 py-2 rounded-md font-medium transition-colors",
                      "bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                    )}
                  >
                    {approveMutation.isPending
                      ? <><Loader2 size={13} className="animate-spin" /> Approving…</>
                      : <><CheckCircle size={13} /> Approve (Assign to Crabby)</>
                    }
                  </button>
                  <button
                    onClick={() => approveMutation.mutate({ spawn: true })}
                    disabled={approveMutation.isPending || !plan.trim()}
                    className={cn(
                      "flex items-center gap-1.5 text-sm px-4 py-2 rounded-md font-medium transition-colors",
                      "bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-50"
                    )}
                  >
                    {approveMutation.isPending
                      ? <><Loader2 size={13} className="animate-spin" /> Spawning…</>
                      : <><Bot size={13} /> Spawn Agent</>
                    }
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
