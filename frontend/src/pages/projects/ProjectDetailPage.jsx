import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { projectsApi } from "../../api/projects";

export default function ProjectDetailPage() {
  const { id } = useParams();

  const { data: project, isLoading, isError } = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectsApi.get(id),
  });

  if (isLoading) {
    return (
      <div className="p-6 text-gray-400 text-sm">Loading project...</div>
    );
  }

  if (isError || !project) {
    return (
      <div className="p-6">
        <Link to="/projects" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-4">
          <ArrowLeft size={14} />
          Back to Projects
        </Link>
        <p className="text-red-400 text-sm">Project not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Link to="/projects" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-4">
        <ArrowLeft size={14} />
        Back to Projects
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <span
          className="w-4 h-4 rounded-full shrink-0"
          style={{ backgroundColor: project.color || "#f97316" }}
        />
        <h1 className="text-2xl font-bold text-white">{project.name}</h1>
      </div>

      {project.description && (
        <p className="text-gray-400 text-sm mt-1 mb-4">{project.description}</p>
      )}

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mt-4">
        <p className="text-gray-400 text-sm">Detail page coming soon.</p>
      </div>
    </div>
  );
}
