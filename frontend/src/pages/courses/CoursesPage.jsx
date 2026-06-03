import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, GraduationCap, Award, Layers, NotebookPen, Link2 } from "lucide-react";
import { coursesApi } from "../../api/courses";
import { cn } from "../../lib/utils";
import CourseForm from "../../components/courses/CourseForm";
import ApiError from "../../components/ui/ApiError";

const STATUS_COLORS = {
  active:    "bg-green-500/20 text-green-400 border-green-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  archived:  "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export default function CoursesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: courses = [], isLoading, isError, error } = useQuery({
    queryKey: ["courses"],
    queryFn: coursesApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: coursesApi.create,
    onSuccess: (course) => {
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["courses"] });
      if (course?.id) navigate(`/courses/${course.id}`);
    },
    // axios error rendered via <ApiError createMutation.error>
  });

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Courses</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {courses.length} course{courses.length !== 1 ? "s" : ""} · saved course materials
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={14} />
          New Course
        </button>
      </div>

      {isError && <div className="mb-4"><ApiError error={error} title="Could not load courses" /></div>}

      {showForm && (
        <>
          {createMutation.isError && (
            <div className="mb-3"><ApiError error={createMutation.error} title="Failed to create course" /></div>
          )}
          <CourseForm
            onSubmit={(data) => createMutation.mutate(data)}
            onCancel={() => setShowForm(false)}
            saving={createMutation.isPending}
          />
        </>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-4 animate-pulse h-28" />
          ))}
        </div>
      ) : courses.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <GraduationCap size={48} className="mb-4 text-gray-600" />
          <p className="text-lg font-medium text-gray-400">No courses yet</p>
          <p className="text-sm mt-1">Create your first course to start saving materials.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map(course => (
            <button
              key={course.id}
              onClick={() => navigate(`/courses/${course.id}`)}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-left hover:border-gray-600 transition-colors w-full"
            >
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap size={16} className="text-orange-400 shrink-0" />
                <span className="text-white font-semibold text-sm truncate flex-1">{course.title}</span>
                <span className={cn("text-xs border rounded px-1.5 py-0.5 shrink-0", STATUS_COLORS[course.status] || STATUS_COLORS.active)}>
                  {course.status}
                </span>
              </div>
              {course.provider && (
                <p className="text-xs text-gray-500 mb-2">{course.provider}</p>
              )}
              {course.description && (
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-3">{course.description}</p>
              )}
              <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
                <span className="flex items-center gap-1"><Layers size={12} /> {course.units_count ?? 0}</span>
                <span className="flex items-center gap-1"><NotebookPen size={12} /> {course.notes_count ?? 0}</span>
                <span className="flex items-center gap-1"><Link2 size={12} /> {course.links_count ?? 0}</span>
                {course.diploma && (
                  <span className="flex items-center gap-1 text-amber-400 ml-auto">
                    <Award size={12} /> Diploma
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
