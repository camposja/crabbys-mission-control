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

    # List all markdown/text docs in the workspace (non-recursive top level)
    def self.list_workspace_docs
      return [] unless Dir.exist?(workspace_path)
      Dir.glob(File.join(workspace_path, "*.{md,txt,json}")).map do |path|
        stat = File.stat(path)
        {
          name:      File.basename(path),
          path:      path,
          size:      stat.size,
          modified:  stat.mtime.iso8601,
          type:      File.extname(path).delete(".")
        }
      end.sort_by { |f| f[:modified] }.reverse
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
    def self.read_file(path)
      real = File.realpath(path)
      raise "Access denied" unless real.start_with?(File.realpath(WORKSPACE_ROOT))
      File.read(real)
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
