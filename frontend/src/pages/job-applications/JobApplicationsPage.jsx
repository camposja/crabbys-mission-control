import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown, ChevronRight, ExternalLink, Plus, User, Bot,
  Clock3, CheckCircle2, Loader2, RefreshCw, Filter, CalendarRange, Save, X,
} from "lucide-react";
import { jobApplicationsApi } from "../../api/jobApplications";
import { cn } from "../../lib/utils";

const STATUS_OPTIONS = ["applied", "pending", "started", "rejected", "interview", "offer", "withdrawn"];

const STATUS_STYLES = {
  applied: "bg-green-500/15 text-green-400 border-green-500/30",
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  started: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  rejected: "bg-red-500/15 text-red-400 border-red-500/30",
  interview: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  offer: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  withdrawn: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

export default function JobApplicationsPage() {
  const qc = useQueryClient();
  const [expandedDates, setExpandedDates] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [syncResult, setSyncResult] = useState(null);

  const queryParams = useMemo(() => {
    const params = {};
    if (statusFilter !== "all") params.status = statusFilter;
    if (sourceFilter !== "all") params.source = sourceFilter;
    if (fromDate) params.from = fromDate;
    if (toDate) params.to = toDate;
    return params;
  }, [statusFilter, sourceFilter, fromDate, toDate]);

  const { data: groups = [], isLoading, isError } = useQuery({
    queryKey: ["job-applications", "grouped-by-date", queryParams],
    queryFn: () => jobApplicationsApi.getGroupedByDate(queryParams),
  });

  const createMutation = useMutation({
    mutationFn: jobApplicationsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-applications"] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => jobApplicationsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-applications"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: jobApplicationsApi.sync,
    onSuccess: (result) => {
      setSyncResult(result);
      qc.invalidateQueries({ queryKey: ["job-applications"] });
    },
  });

  const totalVisible = groups.reduce((sum, group) => sum + group.job_applications.length, 0);

  const toggleDate = (date) => {
    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setSourceFilter("all");
    setFromDate("");
    setToDate("");
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-400">Loading applications…</div>;
  }

  if (isError) {
    return (
      <div className="p-6">
        <div className="bg-red-950/40 border border-red-900 rounded-lg px-4 py-3 text-sm text-red-400">
          Failed to load job applications. The backend may be offline or the migration has not been run yet.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Job Applications</h1>
          <p className="text-sm text-gray-400 mt-1">
            {totalVisible} visible application{totalVisible === 1 ? "" : "s"} across assistant + manual tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg border border-gray-700 transition-colors"
          >
            {syncMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {syncMutation.isPending ? "Syncing…" : "Sync now"}
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 text-sm bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={15} />
            Add manual application
          </button>
        </div>
      </div>

      {syncResult && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-5">
          <div className="flex items-center gap-2 text-sm text-white mb-2">
            <RefreshCw size={14} className="text-orange-400" /> Sync summary
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <InfoBadge label="Files scanned" value={syncResult.files_scanned} />
            <InfoBadge label="Records seen" value={syncResult.records_seen} />
            <InfoBadge label="Records upserted" value={syncResult.records_upserted} />
          </div>
          <p className="text-xs text-gray-500 mt-2 break-all">Source: {syncResult.source_path}</p>
        </div>
      )}

      {showForm && (
        <ManualApplicationForm
          saving={createMutation.isPending}
          error={createMutation.error?.response?.data?.error || createMutation.error?.message}
          onCancel={() => setShowForm(false)}
          onSubmit={(data) => createMutation.mutate(data)}
        />
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-5 space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Filter size={15} className="text-orange-400" />
          Filters
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-2 outline-none"
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map(status => <option key={status} value={status}>{capitalize(status)}</option>)}
          </select>
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-2 outline-none"
          >
            <option value="all">All sources</option>
            <option value="assistant">Assistant</option>
            <option value="manual">Manual</option>
          </select>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <CalendarRange size={13} /> Date range
          </div>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-2 outline-none" />
          <span className="text-gray-600 text-sm">to</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-2 outline-none" />
          <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-white transition-colors">Clear</button>
        </div>
      </div>

      <div className="space-y-4">
        {groups.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
            <p className="text-white font-medium">No applications match the current filters.</p>
            <p className="text-sm text-gray-500 mt-1">Try widening the date range, clearing filters, or syncing again.</p>
          </div>
        )}

        {groups.map((group, index) => {
          const isOpen = expandedDates[group.date] ?? index === 0;
          return (
            <section key={group.date} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleDate(group.date)}
                className="w-full px-4 py-4 flex items-center justify-between gap-3 hover:bg-gray-800/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  <div>
                    <div className="text-white font-semibold">{formatDate(group.date)}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {group.job_applications.length} jobs · {group.job_applications.filter(j => j.source === "assistant").length} assistant · {group.job_applications.filter(j => j.source === "manual").length} manual
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <CountBadge label="Applied" value={group.job_applications.filter(j => j.status === "applied").length} />
                  <CountBadge label="Pending" value={group.job_applications.filter(j => j.status === "pending").length} />
                  <CountBadge label="Started" value={group.job_applications.filter(j => j.status === "started").length} />
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-800 divide-y divide-gray-800">
                  {group.job_applications.map(job => (
                    <ApplicationRow
                      key={job.id}
                      job={job}
                      saving={updateMutation.isPending}
                      onUpdateStatus={(status) => updateMutation.mutate({ id: job.id, data: { status } })}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ManualApplicationForm({ onSubmit, onCancel, saving, error }) {
  const [form, setForm] = useState({
    title: "",
    company: "",
    location: "",
    url: "",
    status: "applied",
    applied_on: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.company.trim() || !form.applied_on) return;
    onSubmit({
      ...form,
      title: form.title.trim(),
      company: form.company.trim(),
      location: form.location.trim() || null,
      url: form.url.trim() || null,
      notes: form.notes.trim() || null,
      source: "manual",
      external_data: {},
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold">Add manual application</h2>
        <button type="button" onClick={onCancel} className="text-gray-500 hover:text-white transition-colors">
          <X size={15} />
        </button>
      </div>

      {error && <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded px-3 py-2">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Job title">
          <input value={form.title} onChange={e => update("title", e.target.value)} required className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-2 outline-none focus:border-orange-500" />
        </Field>
        <Field label="Company">
          <input value={form.company} onChange={e => update("company", e.target.value)} required className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-2 outline-none focus:border-orange-500" />
        </Field>
        <Field label="Location">
          <input value={form.location} onChange={e => update("location", e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-2 outline-none focus:border-orange-500" />
        </Field>
        <Field label="URL">
          <input value={form.url} onChange={e => update("url", e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-2 outline-none focus:border-orange-500" />
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={e => update("status", e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-2 outline-none focus:border-orange-500">
            {STATUS_OPTIONS.map(status => <option key={status} value={status}>{capitalize(status)}</option>)}
          </select>
        </Field>
        <Field label="Applied on">
          <input type="date" value={form.applied_on} onChange={e => update("applied_on", e.target.value)} required className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-2 outline-none focus:border-orange-500" />
        </Field>
      </div>

      <Field label="Notes">
        <textarea value={form.notes} onChange={e => update("notes", e.target.value)} rows={3} className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-2 outline-none focus:border-orange-500 resize-none" />
      </Field>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={saving} className="text-sm bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? "Saving…" : "Save application"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-white transition-colors">Cancel</button>
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-400 mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function CountBadge({ label, value }) {
  return (
    <span className="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded-full px-2.5 py-1">
      {label}: {value}
    </span>
  );
}

function InfoBadge({ label, value }) {
  return (
    <span className="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded-full px-2.5 py-1">
      {label}: {value}
    </span>
  );
}

function ApplicationRow({ job, onUpdateStatus, saving }) {
  const statusClass = STATUS_STYLES[job.status] || STATUS_STYLES.pending;
  const SourceIcon = job.source === "assistant" ? Bot : User;
  const [draftStatus, setDraftStatus] = useState(job.status);

  return (
    <div className="px-4 py-4 flex flex-col xl:flex-row xl:items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <h3 className="text-white font-medium">{job.title}</h3>
          <span className={cn("text-xs border rounded-full px-2 py-0.5", statusClass)}>{job.status}</span>
          <span className="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
            <SourceIcon size={12} />
            {job.source}
          </span>
        </div>
        <div className="text-sm text-gray-300">{job.company}</div>
        <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-3">
          {job.location && <span>{job.location}</span>}
          <span className="inline-flex items-center gap-1"><Clock3 size={12} /> {formatDate(job.applied_on)}</span>
          {job.status === "applied" && <span className="inline-flex items-center gap-1 text-green-400"><CheckCircle2 size={12} /> confirmed</span>}
        </div>
        {job.notes && <p className="text-sm text-gray-400 mt-2 leading-relaxed">{job.notes}</p>}
      </div>

      <div className="flex flex-col items-start xl:items-end gap-2 shrink-0 min-w-[220px]">
        <div className="flex items-center gap-2 w-full xl:justify-end">
          <select
            value={draftStatus}
            onChange={e => setDraftStatus(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-2 outline-none flex-1 xl:flex-none"
          >
            {STATUS_OPTIONS.map(status => <option key={status} value={status}>{capitalize(status)}</option>)}
          </select>
          <button
            onClick={() => onUpdateStatus(draftStatus)}
            disabled={saving || draftStatus === job.status}
            className="inline-flex items-center gap-1 text-sm bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-3 py-2 rounded-lg transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save
          </button>
        </div>

        {job.url && (
          <a href={job.url} target="_blank" rel="noreferrer" className="text-sm text-orange-400 hover:text-orange-300 inline-flex items-center gap-1">
            Open listing <ExternalLink size={13} />
          </a>
        )}
        {job.external_data?.source_file && (
          <span className="text-xs text-gray-600">{job.external_data.source_file}</span>
        )}
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "Unknown date";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
