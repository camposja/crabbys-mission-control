module Api
  module V1
    # Serves workspace documents from ~/.openclaw/workspace/
    # Also includes DB-stored documents
    # SECURITY: Uploads are restricted to ~/.openclaw/workspace/ — no path traversal.
    class DocumentsController < BaseController
      ALLOWED_UPLOAD_TYPES = %w[.md .txt .json .yaml .yml .csv .rst].freeze
      MAX_UPLOAD_BYTES     = 5 * 1024 * 1024  # 5 MB
      # GET /api/v1/documents
      def index
        db_docs = Document.recent
        db_docs = db_docs.where(project_id: params[:project_id]) if params[:project_id].present?

        if params[:project_id].present?
          render json: {
            workspace: [],
            database:  db_docs.limit(50).as_json
          }
        else
          workspace_docs = ::Openclaw::WorkspaceReader.list_workspace_docs
          database_fs_docs = ::Openclaw::WorkspaceReader.list_database_filesystem_docs
          
          # Filter out database docs that duplicate filesystem docs
          fs_titles = database_fs_docs.map { |doc| doc[:name]&.split('/')&.last }.compact
          db_docs_filtered = db_docs.where.not(title: fs_titles)
          
          render json: {
            workspace: workspace_docs,
            database:  (db_docs_filtered.limit(50).as_json + database_fs_docs)
          }
        end
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

      # GET /api/v1/documents/resumes?path=...
      def resumes
        listing = ::Openclaw::WorkspaceReader.list_resumes(params[:path])
        render json: listing
      rescue => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # GET /api/v1/documents/download?path=...
      # Only for resume files — enforced to stay inside resumes/
      # Downloads restricted to .doc and .txt files only.
      DOWNLOADABLE_EXTENSIONS = %w[.doc .txt].freeze

      def download
        path = params[:path].to_s
        raise "Path required" if path.blank?

        real = File.realpath(path)
        resumes_root = File.realpath(::Openclaw::WorkspaceReader.resumes_path)
        raise "Access denied — downloads restricted to resumes" unless real.start_with?(resumes_root)
        raise "File not found" unless File.exist?(real)
        raise "Not a file" unless File.file?(real)

        ext = File.extname(real).downcase
        raise "Download not allowed for #{ext} files. Only #{DOWNLOADABLE_EXTENSIONS.join(', ')} are downloadable." unless DOWNLOADABLE_EXTENSIONS.include?(ext)

        send_file real, filename: File.basename(real), disposition: "attachment"
      rescue => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # GET /api/v1/documents/search?q=...
      def search
        q = params[:q].to_s.strip
        return render(json: { results: [] }) if q.blank?

        # DB full-text search
        db_results = Document.where("title ILIKE ? OR content ILIKE ?", "%#{q}%", "%#{q}%")
                              .limit(20).as_json

        # Workspace file search
        file_results = []
        ::Openclaw::WorkspaceReader.list_workspace_docs.each do |file|
          content = ::Openclaw::WorkspaceReader.read_file(file[:path]) rescue next
          next unless content.downcase.include?(q.downcase)
          start   = [content.downcase.index(q.downcase) - 80, 0].max
          snippet = content[start, 250].gsub(/\s+/, " ").strip
          file_results << file.merge(snippet: snippet)
        end

        render json: { db: db_results, files: file_results }
      end

      # POST /api/v1/documents/upload
      # Saves a file into ~/.openclaw/workspace/
      # Only plain text files up to 5MB are accepted.
      def upload
        file = params[:file]
        raise "No file provided" unless file.present?

        ext = File.extname(file.original_filename).downcase
        raise "File type #{ext} not allowed. Allowed: #{ALLOWED_UPLOAD_TYPES.join(', ')}" unless ALLOWED_UPLOAD_TYPES.include?(ext)
        raise "File too large (max 5MB)" if file.size > MAX_UPLOAD_BYTES

        # Sanitize filename — strip path components and non-safe chars
        safe_name = File.basename(file.original_filename).gsub(/[^\w.\-]/, "_")
        dest_path = File.join(
          ENV.fetch("OPENCLAW_HOME", File.expand_path("~/.openclaw")),
          "workspace", safe_name
        )

        FileUtils.mkdir_p(File.dirname(dest_path))
        IO.copy_stream(file.tempfile, dest_path)

        ::EventStore.emit(type: "document_uploaded", message: "Document uploaded: #{safe_name}")
        render json: { path: dest_path, name: safe_name, size: file.size }, status: :created
      rescue => e
        render json: { error: e.message }, status: :unprocessable_entity
      end
    end
  end
end
