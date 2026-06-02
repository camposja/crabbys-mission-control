import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { coursesApi } from "../../api/courses";

const slugify = (s) =>
  (s || "course").toString().toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "course";

// Generic sample for the standalone (no course context) panel.
const GENERIC_SAMPLE = {
  courses: [
    {
      external_id: "app-development-course",
      title: "App Development Course",
      description: "Course material for building and launching apps.",
      units: [
        {
          external_id: "development",
          title: "Development",
          unit_type: "topic",
          position: 1,
          notes: [
            { external_id: "dev-note-1", note_type: "course_material", title: "Development overview", body: "Material copied from the course." },
            { external_id: "dev-personal-1", note_type: "personal", title: "My implementation thoughts", body: "My own notes go here." },
          ],
          links: [
            { external_id: "dev-link-1", url: "https://example.com", title: "Development resource", source_type: "website", notes: "Explains the development process." },
          ],
        },
      ],
    },
  ],
  deletes: [],
};

// Scoped sample: anchored to the current course by id so the import updates THIS course
// (and backfills its external_id) instead of creating a duplicate.
function buildSample(course) {
  if (!course) return JSON.stringify(GENERIC_SAMPLE, null, 2);
  const externalId = course.external_id || slugify(course.title);
  return JSON.stringify({
    courses: [
      {
        id: course.id,
        external_id: externalId,
        title: course.title,
        units: [
          {
            external_id: "new-unit",
            title: "New Unit",
            unit_type: "topic",
            notes: [
              { external_id: "note-1", note_type: "course_material", title: "Overview", body: "Material from the course." },
            ],
            links: [
              { external_id: "link-1", url: "https://example.com", title: "Resource", source_type: "website" },
            ],
          },
        ],
      },
    ],
    deletes: [],
  }, null, 2);
}

export default function BulkImportPanel({ course = null }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const mutation = useMutation({
    mutationFn: (payload) => coursesApi.bulkUpsert(payload),
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["course"] });
    },
    onError: (err) => {
      setResult(null);
      setError(err?.response?.data?.error || err.message || "Bulk import failed");
    },
  });

  const handleImport = () => {
    setError(null);
    setResult(null);
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      setError("Invalid JSON — check syntax.");
      return;
    }
    mutation.mutate(payload);
  };

  const renderCounts = (label, obj) => {
    const entries = Object.entries(obj || {});
    if (entries.length === 0) return null;
    return (
      <span className="text-xs text-gray-300">
        {label}: {entries.map(([k, v]) => `${v} ${k}`).join(", ")}
      </span>
    );
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Upload size={14} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-white">Bulk import (agent JSON)</h3>
        </div>
        <button
          onClick={() => setText(buildSample(course))}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          {course ? "Insert sample (this course)" : "Insert sample"}
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-2">
        {course
          ? <>Sample is scoped to <span className="text-gray-400">{course.title}</span> (anchored by id, so it updates this course instead of duplicating it). </>
          : null}
        Upsert is keyed by <code className="text-gray-400">external_id</code> (scoped per parent). Deletes only run via an explicit <code className="text-gray-400">deletes</code> array.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste course JSON here…"
        rows={10}
        className="w-full bg-gray-950 text-white text-xs font-mono rounded px-2.5 py-2 border border-gray-700 outline-none resize-y"
      />

      {error && (
        <div className="mt-2 flex items-center gap-2 text-xs text-red-400 bg-red-950/40 border border-red-800 rounded px-3 py-2">
          <AlertCircle size={13} className="shrink-0" /> {error}
        </div>
      )}

      {result && (
        <div className="mt-2 bg-green-500/10 border border-green-500/20 rounded px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={13} className="text-green-400 shrink-0" />
            <span className="text-xs text-green-400 font-medium">Import complete</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {renderCounts("Created", result.created)}
            {renderCounts("Updated", result.updated)}
            {renderCounts("Deleted", result.deleted)}
            {result.errors?.length > 0 && (
              <span className="text-xs text-amber-400">Warnings: {result.errors.join("; ")}</span>
            )}
          </div>
        </div>
      )}

      <button
        onClick={handleImport}
        disabled={!text.trim() || mutation.isPending}
        className="mt-3 text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
      >
        {mutation.isPending && <Loader2 size={11} className="animate-spin" />}
        {mutation.isPending ? "Importing..." : "Run import"}
      </button>
    </div>
  );
}
