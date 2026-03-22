module Api
  module V1
    class MemoriesController < BaseController
      before_action :set_memory, only: [:show, :update, :destroy]

      # GET /api/v1/memories
      # Returns both DB memories and workspace journal files
      def index
        db_memories = Memory.recent
        db_memories = db_memories.by_agent(params[:agent_id])       if params[:agent_id].present?
        db_memories = db_memories.by_type(params[:type])            if params[:type].present?
        db_memories = db_memories.where(project_id: params[:project_id]) if params[:project_id].present?

        if params[:project_id].present?
          render json: {
            memories:  db_memories.limit(100).as_json,
            journals:  []
          }
        else
          workspace_journals = ::Openclaw::WorkspaceReader.list_memory_files
          render json: {
            memories:  db_memories.limit(100).as_json,
            journals:  workspace_journals
          }
        end
      end

      # GET /api/v1/memories/:id
      def show
        render json: @memory
      end

      # GET /api/v1/memories/search?q=...
      def search
        query = params[:q].to_s.strip
        return render(json: { results: [] }) if query.blank?

        # DB text search
        db_results = Memory.where("content ILIKE ?", "%#{query}%").limit(30).as_json

        # Workspace file search
        file_results = []
        ::Openclaw::WorkspaceReader.list_memory_files.each do |file|
          content = ::Openclaw::WorkspaceReader.read_file(file[:path]) rescue next
          if content.downcase.include?(query.downcase)
            snippet_start = [content.downcase.index(query.downcase) - 100, 0].max
            snippet = content[snippet_start, 300].gsub(/\s+/, " ").strip
            file_results << file.merge(snippet: snippet)
          end
        end

        render json: { db: db_results, files: file_results }
      end

      # GET /api/v1/memories/journal?path=...
      def journal
        path    = params[:path].to_s
        content = ::Openclaw::WorkspaceReader.read_file(path)
        render json: { path: path, content: content }
      rescue => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # PATCH /api/v1/memories/journal
      def update_journal
        path    = params[:path].to_s
        content = params[:content].to_s
        ::Openclaw::WorkspaceReader.write_file(path, content)
        ActionCable.server.broadcast("agent_events", { event: "memory_updated", path: path })
        ::EventStore.emit(type: "memory_updated", message: "Journal updated: #{File.basename(path)}")
        render json: { saved: true }
      rescue => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      def update
        @memory.update!(memory_params)
        render json: @memory
      end

      def destroy
        @memory.destroy!
        head :no_content
      end

      private

      def set_memory
        @memory = Memory.find(params[:id])
      end

      def memory_params
        params.require(:memory).permit(:content, :memory_type, :tags, :agent_id, :date, :project_id, metadata: {})
      end
    end
  end
end
