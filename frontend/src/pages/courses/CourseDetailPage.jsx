import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Edit2, GraduationCap, Award, BookOpen, Layers, Upload } from "lucide-react";
import { coursesApi } from "../../api/courses";
import { cn } from "../../lib/utils";
import CourseForm from "../../components/courses/CourseForm";
import CourseUnitList from "../../components/courses/CourseUnitList";
import BulkImportPanel from "../../components/courses/BulkImportPanel";
import NotesPanel from "../../components/notes/NotesPanel";
import LinksPanel from "../../components/links/LinksPanel";
import ApiError from "../../components/ui/ApiError";

const STATUS_COLORS = {
  active:    "bg-green-500/20 text-green-400 border-green-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  archived:  "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const TABS = [
  { id: "material", label: "Course material", icon: BookOpen },
  { id: "units",    label: "Units",           icon: Layers },
  { id: "import",   label: "Bulk import",     icon: Upload },
];

export default function CourseDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("material");
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState(null);
  const [selectedUnitId, setSelectedUnitId] = useState(null);

  const { data: course, isLoading, isError, error } = useQuery({
    queryKey: ["course", id],
    queryFn: () => coursesApi.get(id),
  });

  const updateMutation = useMutation({
    mutationFn: (data) => coursesApi.update(id, data),
    onSuccess: () => {
      setEditing(false);
      setEditError(null);
      qc.invalidateQueries({ queryKey: ["course", id] });
      qc.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: (err) => setEditError(err?.response?.data?.error || err.message || "Failed to update course"),
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-6"><ArrowLeft size={14} /><span>Back to Courses</span></div>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-800 rounded w-1/3" />
          <div className="h-32 bg-gray-800 rounded" />
        </div>
      </div>
    );
  }

  if (isError || !course) {
    return (
      <div className="p-6">
        <Link to="/courses" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-4">
          <ArrowLeft size={14} /> Back to Courses
        </Link>
        <ApiError error={error} title="Could not load this course" />
      </div>
    );
  }

  const units = course.units || [];
  const selectedUnit = units.find((u) => u.id === selectedUnitId) || null;

  return (
    <div className="p-4 md:p-6">
      <Link to="/courses" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-4">
        <ArrowLeft size={14} /> Back to Courses
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-1 flex-wrap">
        <GraduationCap size={20} className="text-orange-400 shrink-0" />
        <h1 className="text-2xl font-bold text-white">{course.title}</h1>
        <span className={cn("text-xs border rounded px-1.5 py-0.5", STATUS_COLORS[course.status] || STATUS_COLORS.active)}>
          {course.status}
        </span>
        {course.diploma && (
          <span className="flex items-center gap-1 text-xs border border-amber-500/30 bg-amber-500/20 text-amber-300 rounded px-1.5 py-0.5">
            <Award size={12} /> Diploma
          </span>
        )}
        <button onClick={() => setEditing(true)} className="ml-auto text-gray-500 hover:text-white transition-colors">
          <Edit2 size={16} />
        </button>
      </div>
      {course.provider && <p className="text-sm text-gray-500 ml-8">{course.provider}</p>}
      {course.description && <p className="text-gray-400 text-sm mt-1 mb-2 ml-8">{course.description}</p>}
      {course.diploma && course.diploma_notes && (
        <p className="text-xs text-amber-300/80 mt-1 mb-2 ml-8">📜 {course.diploma_notes}</p>
      )}

      {editing && (
        <div className="mt-4">
          <CourseForm
            course={course}
            onSubmit={(data) => updateMutation.mutate(data)}
            onCancel={() => { setEditing(false); setEditError(null); }}
            saving={updateMutation.isPending}
            error={editError}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-700 flex gap-6 mb-6 mt-5">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 pb-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                isActive ? "border-orange-500 text-white" : "border-transparent text-gray-400 hover:text-white"
              )}
            >
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* General course material */}
      {activeTab === "material" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <NotesPanel
            owner={{ notable_type: "Course", notable_id: course.id }}
            title="Course notes"
          />
          <LinksPanel
            owner={{ linkable_type: "Course", linkable_id: course.id }}
            title="Course links"
          />
        </div>
      )}

      {/* Units */}
      {activeTab === "units" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <CourseUnitList
              courseId={course.id}
              units={units}
              selectedUnitId={selectedUnitId}
              onSelect={setSelectedUnitId}
            />
          </div>
          <div className="lg:col-span-2 space-y-4">
            {selectedUnit ? (
              <>
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-gray-400" />
                  <h2 className="text-sm font-semibold text-white">{selectedUnit.title}</h2>
                  <span className="text-xs text-gray-500">{selectedUnit.unit_type}</span>
                </div>
                <NotesPanel
                  owner={{ notable_type: "CourseUnit", notable_id: selectedUnit.id }}
                  title="Unit notes"
                />
                <LinksPanel
                  owner={{ linkable_type: "CourseUnit", linkable_id: selectedUnit.id }}
                  title="Unit links"
                />
              </>
            ) : (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center text-sm text-gray-500">
                Select a unit to view and edit its notes and links.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk import */}
      {activeTab === "import" && (
        <div className="max-w-2xl">
          <BulkImportPanel course={course} />
        </div>
      )}
    </div>
  );
}
