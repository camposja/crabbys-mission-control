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
          render json: {
            workspace: workspace_docs,
            database:  db_docs.limit(50).as_json
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

      # GET /api/v1/documents/projects?path=...
      def projects
        listing = ::Openclaw::WorkspaceReader.list_project_docs(params[:path])
        render json: listing
      rescue => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # GET /api/v1/documents/download?path=...
      # Only for resume files — enforced to stay inside resumes/
      # Downloads restricted to .doc and .txt files only.
      DOWNLOADABLE_EXTENSIONS = %w[.doc .txt].freeze

      def download
        requested = params[:path].to_s
        raise "Path required" if requested.blank?

        root       = File.realpath(::Openclaw::WorkspaceReader.resumes_path)
        candidates = downloadable_resumes(root)
        index      = candidates.index { |candidate| names_same_file?(candidate, root, requested) }
        raise "Access denied — only #{DOWNLOADABLE_EXTENSIONS.join(', ')} files inside resumes/ can be downloaded" if index.nil?

        # Comes from the directory listing, never from the parameter.
        entry = candidates.fetch(index)
        send_file entry, filename: File.basename(entry), disposition: "attachment"
      rescue Errno::ENOENT
        render json: { error: "No resumes directory to download from" }, status: :unprocessable_entity
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

        ext = File.extname(file.original_filename.to_s).downcase
        raise "File type #{ext.presence || '(none)'} not allowed. Allowed: #{ALLOWED_UPLOAD_TYPES.join(', ')}" unless ALLOWED_UPLOAD_TYPES.include?(ext)
        raise "File too large (max 5MB)" if file.size > MAX_UPLOAD_BYTES

        # Strip directories, traversal and exotic characters, then prove the
        # destination really is inside the workspace before writing anything.
        safe_name = SafePath.sanitized_basename(file.original_filename)
        raise "Filename is not usable" if safe_name.nil?

        workspace = ::Openclaw::WorkspaceReader.workspace_path
        FileUtils.mkdir_p(workspace)
        dest_path = SafePath.join_within!(workspace, safe_name)

        IO.copy_stream(file.tempfile, dest_path)

        ::EventStore.emit(type: "document_uploaded", message: "Document uploaded: #{safe_name}")
        render json: { path: dest_path, name: safe_name, size: file.size }, status: :created
      rescue => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      private

      # Does this candidate from the listing answer to the name the request used?
      # Comparison only — the parameter never becomes a path. Traversal
      # ("../../etc/passwd"), sibling-prefix paths ("…/resumes-evil/x.txt") and
      # symlinks pointing outside resumes/ have no matching candidate at all.
      def names_same_file?(candidate, root, requested)
        prefix = root + File::SEPARATOR
        return true if candidate == requested
        return true if candidate.delete_prefix(prefix) == requested.delete_prefix(prefix)

        # A client may name the same file through a symlinked parent (on macOS
        # /var is a link to /private/var, for example). Comparison only: the
        # resolved value is never used as a path, and it has to equal a listed
        # candidate, so traversal, sibling-prefix and escaping symlinks still
        # resolve to something that is not on the list.
        File.exist?(requested) && File.realpath(requested) == candidate
      rescue SystemCallError
        false
      end

      def downloadable_resumes(root)
        Dir.glob(File.join(root, "**", "*")).select do |candidate|
          next false unless File.file?(candidate)
          next false unless DOWNLOADABLE_EXTENSIONS.include?(File.extname(candidate).downcase)

          # Drops symlinks inside resumes/ that resolve outside it.
          SafePath.contained?(File.realpath(candidate), root)
        end
      end
    end
  end
end
