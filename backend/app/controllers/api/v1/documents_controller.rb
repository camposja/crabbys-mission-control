module Api
  module V1
    # Serves workspace documents from ~/.openclaw/workspace/
    # Also includes DB-stored documents
    class DocumentsController < BaseController
      # GET /api/v1/documents
      def index
        workspace_docs = ::Openclaw::WorkspaceReader.list_workspace_docs
        db_docs        = Document.recent.limit(50).as_json

        render json: {
          workspace: workspace_docs,
          database:  db_docs
        }
      end

      # GET /api/v1/documents/content?path=...
      def content
        path = params[:path].to_s
        raise "Path required" if path.blank?

        text = ::Openclaw::WorkspaceReader.read_file(path)
        render json: { path: path, content: text }
      rescue => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # PATCH /api/v1/documents/content
      def update_content
        path    = params[:path].to_s
        content = params[:content].to_s
        raise "Path required" if path.blank?

        ::Openclaw::WorkspaceReader.write_file(path, content)
        ::EventStore.emit(type: "document_updated", message: "Document updated: #{File.basename(path)}")
        render json: { path: path, saved: true }
      rescue => e
        render json: { error: e.message }, status: :unprocessable_entity
      end
    end
  end
end
