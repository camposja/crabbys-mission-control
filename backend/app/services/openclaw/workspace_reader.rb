require "shellwords"

# Reads files directly from the OpenClaw workspace directory.
# This is the "thin layer" philosophy — we don't copy data, we serve it live.
module Openclaw
  module WorkspaceReader
    WORKSPACE_ROOT = ENV.fetch("OPENCLAW_HOME", File.expand_path("~/.openclaw"))

    def self.workspace_path
      File.join(WORKSPACE_ROOT, "workspace")
    end

    def self.memory_path
      File.join(workspace_path, "memory")
    end

    def self.agents_path
      File.join(WORKSPACE_ROOT, "agents")
    end

    # List all markdown/text docs in the workspace (non-recursive top level only)
    def self.list_workspace_docs
      return [] unless Dir.exist?(workspace_path)

      # Top-level workspace files only (no subdirectories)
      files = Dir.glob(File.join(workspace_path, "*.{md,txt,json}")).map do |path|
        stat = File.stat(path)
        {
          name:      File.basename(path),
          path:      path,
          size:      stat.size,
          modified:  stat.mtime.iso8601,
          type:      File.extname(path).delete(".")
        }
      end

      files.sort_by { |f| f[:modified] }.reverse
    end

    # List project docs for the "Mission Control (DB)" tab.
    # Organizes files into virtual folders (e.g., QR Doorbell).
    def self.list_database_filesystem_docs
      return [] unless Dir.exist?(workspace_path)

      docs = []

      # QR Doorbell project files
      qr_doorbell_dir = File.join(workspace_path, "projects", "qr-doorbell")
      if Dir.exist?(qr_doorbell_dir)
        Dir.glob(File.join(qr_doorbell_dir, "*.{md,txt}")).each do |path|
          stat = File.stat(path)
          docs << {
            name:     "qr-doorbell/#{File.basename(path)}",
            path:     path,
            folder:   "qr-doorbell",
            size:     stat.size,
            modified: stat.mtime.iso8601,
            type:     File.extname(path).delete(".")
          }
        end
      end

      docs.sort_by { |f| f[:modified] }.reverse
    end

    # ── Resumes ──────────────────────────────────────────────────────────
    def self.resumes_path
      File.join(workspace_path, "resumes")
    end

    # Browse a directory inside resumes/. Returns folders and files.
    # +subpath+ is relative to resumes/, e.g. "base" or "tailored".
    def self.list_resumes(subpath = nil)
      base = resumes_path
      return { folders: [], files: [] } unless Dir.exist?(base)

      target = subpath.present? ? File.join(base, subpath) : base

      # Safety: ensure we stay inside resumes/
      real_target = File.realpath(target) rescue target
      real_base   = File.realpath(base)
      raise "Access denied" unless real_target.start_with?(real_base)
      raise "Not a directory" unless File.directory?(real_target)

      entries = Dir.entries(real_target).reject { |e| e.start_with?(".") }.sort

      folders = entries.select { |e| File.directory?(File.join(real_target, e)) }.map do |name|
        rel = subpath.present? ? File.join(subpath, name) : name
        { name: name, path: rel }
      end

      files = entries.reject { |e| File.directory?(File.join(real_target, e)) }.map do |name|
        full = File.join(real_target, name)
        stat = File.stat(full)
        rel  = subpath.present? ? File.join(subpath, name) : name
        {
          name:     name,
          path:     full,
          relative: rel,
          size:     stat.size,
          modified: stat.mtime.iso8601,
          type:     File.extname(name).delete(".")
        }
      end

      { folders: folders, files: files, current_path: subpath || "" }
    end

    # List memory journal files
    def self.list_memory_files
      return [] unless Dir.exist?(memory_path)
      Dir.glob(File.join(memory_path, "**/*.md")).map do |path|
        relative = path.sub("#{memory_path}/", "")
        stat     = File.stat(path)
        {
          name:     File.basename(path, ".md"),
          path:     path,
          relative: relative,
          size:     stat.size,
          modified: stat.mtime.iso8601
        }
      end.sort_by { |f| f[:name] }.reverse
    end

    # Read a file's content (only files inside WORKSPACE_ROOT for safety)
    # .docx files are extracted to plain text (read-only preview).
    # .pdf files are not supported for preview.
    BINARY_PREVIEW_TYPES = %w[.pdf].freeze

    def self.read_file(path)
      real = File.realpath(path)
      raise "Access denied" unless real.start_with?(File.realpath(WORKSPACE_ROOT))

      ext = File.extname(real).downcase

      if BINARY_PREVIEW_TYPES.include?(ext)
        raise "Preview not available for #{ext} files"
      elsif ext == ".docx"
        read_docx_as_text(real)
      else
        File.read(real)
      end
    end

    # Extract plain text from a .docx file.
    # Uses macOS/Linux `unzip` to read word/document.xml, then strips XML tags.
    # No extra gems required.
    def self.read_docx_as_text(path)
      # Extract word/document.xml from the docx (which is a zip file)
      xml = `unzip -p #{Shellwords.escape(path)} word/document.xml 2>/dev/null`
      raise "Could not read .docx file — invalid or corrupted" if xml.blank?

      # Strip XML tags, preserve paragraph/row structure
      xml.gsub(/<\/w:p>/, "\n")          # paragraph breaks
         .gsub(/<\/w:tr>/, "\n")          # table row breaks
         .gsub(/<[^>]+>/, "")             # strip all XML tags
         .gsub(/&amp;/, "&")
         .gsub(/&lt;/, "<")
         .gsub(/&gt;/, ">")
         .gsub(/&quot;/, '"')
         .gsub(/&apos;/, "'")
         .gsub(/[ \t]+/, " ")             # collapse horizontal whitespace
         .gsub(/\n{3,}/, "\n\n")          # collapse excessive newlines
         .strip
    end

    # Write back to a workspace file
    def self.write_file(path, content)
      real = File.realpath(path)
      raise "Access denied" unless real.start_with?(File.realpath(WORKSPACE_ROOT))
      File.write(real, content)
    end

    # List known agents from the agents directory
    def self.list_local_agents
      return [] unless Dir.exist?(agents_path)
      Dir.entries(agents_path)
         .reject { |e| e.start_with?(".") }
         .select { |e| File.directory?(File.join(agents_path, e)) }
         .map do |name|
           agent_file = File.join(agents_path, name, "agent")
           config = File.exist?(agent_file) ? begin JSON.parse(File.read(agent_file)) rescue {} end : {}
           {
             id:     name,
             name:   config["name"] || name,
             model:  config.dig("model", "primary") || config["model"],
             status: "unknown",
             local:  true
           }
         end
    end

    # Parse openclaw.json for model/provider config
    def self.models_config
      config_path = File.join(WORKSPACE_ROOT, "openclaw.json")
      return {} unless File.exist?(config_path)
      JSON.parse(File.read(config_path)).dig("models", "providers") || {}
    rescue
      {}
    end
  end
end
