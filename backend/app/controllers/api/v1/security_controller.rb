module Api
  module V1
    # Runs local security audits and returns actionable findings.
    #
    # IMPORTANT: This app is a LOCAL, SELF-HOSTED tool.
    # - It must NEVER send data to external services.
    # - Anyone with network access to this Rails server has FULL ADMIN ACCESS
    #   to your OpenClaw agents. Keep it bound to localhost only.
    # - Use Tailscale or SSH port-forwarding if you need remote access — never
    #   expose the port directly.
    class SecurityController < BaseController
      OPENCLAW_HOME = ENV.fetch("OPENCLAW_HOME", File.expand_path("~/.openclaw"))

      # GET /api/v1/security/audit
      def audit
        findings = [
          audit_openclaw_dir_permissions,
          audit_env_file,
          audit_git_secrets,
          audit_agent_configs,
          audit_network_binding,
          audit_gateway_token,
        ].flatten.compact

        critical_count = findings.count { |f| f[:severity] == "critical" }
        warning_count  = findings.count { |f| f[:severity] == "warning"  }

        render json: {
          findings:       findings,
          critical_count: critical_count,
          warning_count:  warning_count,
          info_count:     findings.count { |f| f[:severity] == "info" },
          overall:        critical_count > 0 ? "critical" : warning_count > 0 ? "warning" : "ok",
          audited_at:     Time.current.iso8601,
          local_only_warning: "This app has full access to your local shell and OpenClaw agents. " \
                              "NEVER expose it to the internet. " \
                              "Bind Rails to 127.0.0.1 only (the default)."
        }
      end

      # GET /api/v1/security/remote_access
      def remote_access
        render json: {
          tailscale:    tailscale_status,
          ssh_tunnels:  ssh_tunnel_count,
          local_ip:     local_ip,
          recommendations: [
            "Use Tailscale (tailscale.com) for secure remote access without opening firewall ports.",
            "Alternatively: ssh -L 3000:localhost:3000 your-machine",
            "NEVER expose port 3000 or 18789 directly on a public interface.",
            "Keep agent memory and intelligence local — only use external services for UI state if needed."
          ]
        }
      end

      # GET /api/v1/security/permissions
      def permissions
        agent_dirs = Dir.glob(File.join(OPENCLAW_HOME, "agents", "*")).select { |d| File.directory?(d) }
        agents = agent_dirs.map do |dir|
          name       = File.basename(dir)
          config_file = File.join(dir, "agent")
          config     = File.exist?(config_file) ? (JSON.parse(File.read(config_file)) rescue {}) : {}
          {
            id:          name,
            name:        config["name"] || name,
            permissions: config["permissions"] || config["allowed_tools"] || [],
            model:       config.dig("model", "primary") || config["model"]
          }
        end
        render json: { agents: agents }
      rescue => e
        render json: { agents: [], error: e.message }
      end

      private

      # ── Audit checks ────────────────────────────────────────────────────────

      def audit_openclaw_dir_permissions
        return nil unless Dir.exist?(OPENCLAW_HOME)
        mode = File.stat(OPENCLAW_HOME).mode & 0o777
        if mode & 0o077 != 0
          {
            id:         "openclaw_dir_perms",
            title:      "~/.openclaw is world- or group-readable",
            severity:   "warning",
            detail:     "Current permissions: #{format('%04o', mode)}. Recommended: 0700.",
            fix:        "chmod 700 #{OPENCLAW_HOME}",
            category:   "filesystem"
          }
        else
          { id: "openclaw_dir_perms", title: "~/.openclaw permissions OK", severity: "ok",
            detail: format('%04o', mode), category: "filesystem" }
        end
      end

      def audit_env_file
        env_path = Rails.root.join(".env")
        return nil unless File.exist?(env_path)
        mode = File.stat(env_path).mode & 0o777
        findings = []
        if mode & 0o044 != 0
          findings << {
            id:       "env_file_perms",
            title:    ".env file is readable by group/others",
            severity: "warning",
            detail:   "Current permissions: #{format('%04o', mode)}. Recommended: 0600.",
            fix:      "chmod 600 #{env_path}",
            category: "filesystem"
          }
        end
        # Check .env is in .gitignore
        gitignore = Rails.root.join(".gitignore")
        if File.exist?(gitignore) && !File.read(gitignore).include?(".env")
          findings << {
            id:       "env_not_gitignored",
            title:    ".env is not in .gitignore",
            severity: "critical",
            detail:   "Your API keys and tokens could be committed to version control.",
            fix:      'echo ".env" >> .gitignore',
            category: "secrets"
          }
        end
        findings.presence || [{ id: "env_file_perms", title: ".env file permissions OK",
                                 severity: "ok", detail: format('%04o', mode), category: "filesystem" }]
      end

      def audit_git_secrets
        findings = []
        git_dir = Rails.root.join(".git")
        return [] unless Dir.exist?(git_dir)

        # Check if any .env or secrets files are tracked
        tracked = `git -C #{Rails.root} ls-files --error-unmatch .env 2>/dev/null`.strip
        if $?.success? && tracked.present?
          findings << {
            id:       "env_in_git",
            title:    ".env file is tracked by git",
            severity: "critical",
            detail:   ".env is committed — your secrets may be exposed in git history.",
            fix:      "git rm --cached .env && echo '.env' >> .gitignore && git commit -m 'remove .env from tracking'",
            category: "secrets"
          }
        end
        findings
      rescue
        []
      end

      def audit_agent_configs
        findings = []
        agent_dirs = Dir.glob(File.join(OPENCLAW_HOME, "agents", "*")).select { |d| File.directory?(d) }
        agent_dirs.each do |dir|
          config_file = File.join(dir, "agent")
          next unless File.exist?(config_file)
          config = JSON.parse(File.read(config_file)) rescue next
          # Warn if agent has broad shell execution permissions
          tools = Array(config["permissions"] || config["allowed_tools"] || [])
          if tools.any? { |t| t.to_s.include?("shell") || t.to_s.include?("exec") || t.to_s == "*" }
            findings << {
              id:       "agent_shell_#{File.basename(dir)}",
              title:    "Agent '#{config['name'] || File.basename(dir)}' has shell execution permission",
              severity: "info",
              detail:   "Permitted tools: #{tools.join(', ')}. Review if this is intentional.",
              fix:      "Edit #{config_file} to restrict allowed_tools",
              category: "permissions"
            }
          end
        end
        findings
      rescue
        []
      end

      def audit_network_binding
        # Check if the Rails server appears to be bound beyond localhost
        # We can only inspect the currently-known host
        bound_host = ENV.fetch("RAILS_BIND", "127.0.0.1")
        if bound_host == "0.0.0.0" || bound_host == "::"
          [{
            id:       "network_binding",
            title:    "Server appears to be bound to all interfaces",
            severity: "critical",
            detail:   "RAILS_BIND=#{bound_host} — this exposes the terminal and all APIs to the network.",
            fix:      "Set RAILS_BIND=127.0.0.1 in your startup command or .env file.",
            category: "network"
          }]
        else
          [{ id: "network_binding", title: "Network binding OK (localhost only)",
             severity: "ok", detail: "Bound to #{bound_host}", category: "network" }]
        end
      end

      def audit_gateway_token
        token = ENV["OPENCLAW_GATEWAY_TOKEN"].to_s
        if token.length < 20
          [{
            id:       "gateway_token_weak",
            title:    "Gateway token is missing or very short",
            severity: "critical",
            detail:   "OPENCLAW_GATEWAY_TOKEN should be a long random string.",
            fix:      "Generate one: openssl rand -base64 32",
            category: "secrets"
          }]
        else
          [{ id: "gateway_token", title: "Gateway token looks OK",
             severity: "ok", detail: "Token length: #{token.length} chars", category: "secrets" }]
        end
      end

      # ── System info ─────────────────────────────────────────────────────────

      def tailscale_status
        output = `tailscale status 2>/dev/null`.strip
        if $?.success? && output.present?
          ip = output.scan(/\b100\.\d+\.\d+\.\d+\b/).first
          { connected: true, ip: ip, raw: output.lines.first.strip }
        else
          { connected: false, ip: nil }
        end
      rescue
        { connected: false, ip: nil, error: "tailscale not installed" }
      end

      def ssh_tunnel_count
        output = `lsof -i -n -P 2>/dev/null | grep -c "ssh" || echo 0`.strip
        output.to_i
      rescue
        0
      end

      def local_ip
        Socket.ip_address_list.find { |addr| addr.ipv4? && !addr.ipv4_loopback? }&.ip_address
      rescue
        "127.0.0.1"
      end
    end
  end
end
