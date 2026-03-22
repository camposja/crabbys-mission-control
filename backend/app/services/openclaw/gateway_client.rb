# WebSocket JSON-RPC client for the OpenClaw gateway (ws://127.0.0.1:18789).
#
# Protocol (discovered from OpenClaw source):
#   1. Connect WebSocket to gateway URL
#   2. Server sends event: {"event":"connect.challenge","payload":{"nonce":"..."}}
#   3. Client sends request with "connect" method including device identity + auth
#   4. Server responds with hello.ok payload
#   5. Client sends RPC requests: {"type":"req","id":"<uuid>","method":"agents.list","params":{}}
#   6. Server responds: {"id":"<uuid>","ok":true,"payload":{...}} or {"id":"...","ok":false,"error":{...}}
#
# Device identity: Ed25519 keypair stored at ~/.openclaw/mc-identity/device.json.
#   The gateway requires device identity to grant operator scopes.
#   Without it, all scopes are cleared and most RPC methods return "missing scope".
#
# Auth: Token from OPENCLAW_GATEWAY_TOKEN env var, sent inside the "connect" handshake.
require "socket"
require "openssl"
require "websocket"
require "securerandom"
require "json"
require "uri"
require "timeout"
require "base64"
require "digest"

module Openclaw
  class GatewayClient
    # Used by integration_check_controller to display the gateway URL.
    BASE_URL = ENV.fetch("OPENCLAW_GATEWAY_URL", "http://localhost:18789")

    # Default timeout for a single RPC call (seconds).
    RPC_TIMEOUT = 15

    # All operator scopes (matches CLI_DEFAULT_OPERATOR_SCOPES from OpenClaw source).
    ALL_SCOPES = %w[
      operator.admin
      operator.read
      operator.write
      operator.approvals
      operator.pairing
    ].freeze

    # ---- public high-level helpers (used by controllers & jobs) ----

    # Perform an RPC call to the OpenClaw gateway.
    #   method: e.g. "agents.list", "chat.send", "sessions.list"
    #   params: Hash of params for the RPC method
    def rpc(method, params = {})
      ws_url = build_ws_url
      token  = ENV["OPENCLAW_GATEWAY_TOKEN"]
      device = load_or_create_device_identity

      result = nil

      Timeout.timeout(RPC_TIMEOUT) do
        uri = URI.parse(ws_url)
        sock = open_socket(uri)

        begin
          # WebSocket handshake
          handshake = WebSocket::Handshake::Client.new(url: ws_url)
          sock.write(handshake.to_s)

          # Read handshake response
          until handshake.finished?
            data = sock.readpartial(4096)
            handshake << data
          end

          raise GatewayError, "WebSocket handshake failed" unless handshake.valid?

          frame_parser = WebSocket::Frame::Incoming::Client.new

          # Step 1: Wait for connect.challenge event
          nonce = wait_for_challenge(sock, frame_parser)

          # Step 2: Send connect request with auth + device identity
          connect_id = SecureRandom.uuid
          signed_at_ms = (Time.now.to_f * 1000).to_i

          # Build device auth payload for signature (v3 format)
          device_payload = build_device_auth_payload_v3(
            device_id: device[:device_id],
            client_id: "gateway-client",
            client_mode: "backend",
            role: "operator",
            scopes: ALL_SCOPES,
            signed_at_ms: signed_at_ms,
            token: token || "",
            nonce: nonce,
            platform: RUBY_PLATFORM,
            device_family: nil
          )
          signature = sign_device_payload(device[:private_key_pem], device_payload)

          connect_req = {
            type: "req",
            id: connect_id,
            method: "connect",
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: "gateway-client",
                displayName: "Crabbys Mission Control",
                version: "0.1.0",
                platform: RUBY_PLATFORM,
                mode: "backend",
                instanceId: SecureRandom.uuid
              },
              caps: [],
              auth: token.present? ? { token: token } : nil,
              role: "operator",
              scopes: ALL_SCOPES,
              device: {
                id: device[:device_id],
                publicKey: public_key_raw_base64url(device[:public_key_pem]),
                signature: signature,
                signedAt: signed_at_ms,
                nonce: nonce
              }
            }.compact
          }
          send_frame(sock, connect_req)

          # Step 3: Wait for connect response (hello.ok)
          wait_for_response(sock, frame_parser, connect_id)

          # Step 4: Send the actual RPC request
          req_id = SecureRandom.uuid
          rpc_req = {
            type: "req",
            id: req_id,
            method: method,
            params: params
          }
          send_frame(sock, rpc_req)

          # Step 5: Wait for response
          result = wait_for_response(sock, frame_parser, req_id)
        ensure
          # Send close frame and shut down
          begin
            close_frame = WebSocket::Frame::Outgoing::Client.new(
              data: "",
              type: :close,
              version: handshake.version
            )
            sock.write(close_frame.to_s)
          rescue StandardError
            # ignore close errors
          end
          sock.close rescue nil
        end
      end

      result
    rescue Timeout::Error
      raise GatewayError, "OpenClaw gateway RPC timeout (#{method})"
    rescue Errno::ECONNREFUSED, Errno::ECONNRESET, Errno::EPIPE, IOError => e
      raise GatewayError, "OpenClaw gateway connection failed: #{e.message}"
    end

    # Convenience wrapper for chat.send RPC with correct parameter format.
    # Accepts the simpler agent_id/session_id/content form used throughout the app
    # and translates to the gateway's expected sessionKey/message/idempotencyKey format.
    #
    #   agent_id:   "main" (default)
    #   session_id: a label like "heartbeat-tasks", "planning-123", etc.
    #   content:    the message text
    def chat_send(content:, agent_id: "main", session_id: "main")
      session_key = "agent:#{agent_id}:#{session_id}"
      rpc("chat.send", {
        sessionKey:     session_key,
        message:        content,
        idempotencyKey: SecureRandom.uuid
      })
    end

    # HTTP health check -- the one HTTP endpoint that still works.
    def health
      conn = Faraday.new(url: BASE_URL) do |f|
        f.response :json
        f.adapter  Faraday.default_adapter
      end
      response = conn.get("/health")
      raise GatewayError, "OpenClaw gateway health error: #{response.status}" unless response.success?
      response.body
    end

    # Legacy compatibility: controllers that called gateway.get("/health") still work.
    def get(path, _params = {})
      if path == "/health"
        health
      else
        raise GatewayError, "HTTP GET is not supported by the OpenClaw gateway (use rpc method). Path: #{path}"
      end
    end

    # Legacy compatibility: controllers that called gateway.post(...) get a clear error.
    def post(path, _body = {})
      raise GatewayError, "HTTP POST is not supported by the OpenClaw gateway (use rpc method). Path: #{path}"
    end

    private

    def build_ws_url
      raw = ENV.fetch("OPENCLAW_GATEWAY_URL", "http://localhost:18789")
      # Convert http(s) scheme to ws(s)
      raw.sub(%r{^http(s?)://}, 'ws\1://')
    end

    def open_socket(uri)
      host = uri.host || "127.0.0.1"
      port = uri.port || 18789

      tcp = TCPSocket.new(host, port)
      tcp.setsockopt(Socket::IPPROTO_TCP, Socket::TCP_NODELAY, 1)

      if uri.scheme == "wss"
        ctx = OpenSSL::SSL::SSLContext.new
        ssl = OpenSSL::SSL::SSLSocket.new(tcp, ctx)
        ssl.hostname = host
        ssl.connect
        ssl
      else
        tcp
      end
    end

    def send_frame(sock, data)
      frame = WebSocket::Frame::Outgoing::Client.new(
        data: data.to_json,
        type: :text,
        version: 13
      )
      sock.write(frame.to_s)
    end

    def read_frames(sock, frame_parser)
      data = sock.readpartial(65_536)
      frame_parser << data

      messages = []
      while (frame = frame_parser.next)
        messages << frame if frame.type == :text
      end
      messages
    end

    def wait_for_challenge(sock, frame_parser)
      deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + 5
      loop do
        remaining = deadline - Process.clock_gettime(Process::CLOCK_MONOTONIC)
        raise GatewayError, "Timeout waiting for connect challenge" if remaining <= 0

        if IO.select([sock], nil, nil, [remaining, 1].min)
          messages = read_frames(sock, frame_parser)
          messages.each do |msg|
            parsed = JSON.parse(msg.data)
            if parsed["event"] == "connect.challenge"
              nonce = parsed.dig("payload", "nonce")
              raise GatewayError, "Connect challenge missing nonce" unless nonce.present?
              return nonce
            end
          end
        end
      end
    end

    def wait_for_response(sock, frame_parser, request_id)
      deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + 10
      loop do
        remaining = deadline - Process.clock_gettime(Process::CLOCK_MONOTONIC)
        raise GatewayError, "Timeout waiting for RPC response" if remaining <= 0

        if IO.select([sock], nil, nil, [remaining, 1].min)
          messages = read_frames(sock, frame_parser)
          messages.each do |msg|
            parsed = JSON.parse(msg.data)
            # Response frames have an "id" matching our request
            next unless parsed["id"] == request_id

            if parsed["ok"] == true || (parsed["ok"].nil? && parsed.key?("payload"))
              return parsed["payload"] || parsed
            else
              err_msg = parsed.dig("error", "message") || "RPC error"
              err_code = parsed.dig("error", "code") || "UNKNOWN"
              raise GatewayError, "OpenClaw RPC error (#{err_code}): #{err_msg}"
            end
          end
        end
      end
    end

    # ---- Device identity (Ed25519 keypair) ----

    IDENTITY_DIR = File.expand_path("~/.openclaw/mc-identity")
    IDENTITY_FILE = File.join(IDENTITY_DIR, "device.json")

    def load_or_create_device_identity
      if File.exist?(IDENTITY_FILE)
        raw = JSON.parse(File.read(IDENTITY_FILE))
        if raw["version"] == 1 && raw["deviceId"] && raw["publicKeyPem"] && raw["privateKeyPem"]
          return {
            device_id: raw["deviceId"],
            public_key_pem: raw["publicKeyPem"],
            private_key_pem: raw["privateKeyPem"]
          }
        end
      end

      identity = generate_device_identity
      FileUtils.mkdir_p(IDENTITY_DIR)
      stored = {
        version: 1,
        deviceId: identity[:device_id],
        publicKeyPem: identity[:public_key_pem],
        privateKeyPem: identity[:private_key_pem],
        createdAtMs: (Time.now.to_f * 1000).to_i
      }
      File.write(IDENTITY_FILE, JSON.pretty_generate(stored) + "\n")
      File.chmod(0600, IDENTITY_FILE)
      identity
    end

    def generate_device_identity
      key = OpenSSL::PKey.generate_key("ED25519")
      public_pem = key.public_to_pem
      private_pem = key.private_to_pem
      device_id = fingerprint_public_key(public_pem)
      {
        device_id: device_id,
        public_key_pem: public_pem,
        private_key_pem: private_pem
      }
    end

    # SHA-256 hex digest of the raw 32-byte Ed25519 public key
    def fingerprint_public_key(public_key_pem)
      raw = derive_public_key_raw(public_key_pem)
      Digest::SHA256.hexdigest(raw)
    end

    # Extract the raw 32-byte Ed25519 public key from SPKI DER
    ED25519_SPKI_PREFIX = [0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00].pack("C*")

    def derive_public_key_raw(public_key_pem)
      pub = OpenSSL::PKey.read(public_key_pem)
      spki = pub.public_to_der
      if spki.bytesize == ED25519_SPKI_PREFIX.bytesize + 32 &&
         spki[0, ED25519_SPKI_PREFIX.bytesize] == ED25519_SPKI_PREFIX
        spki[ED25519_SPKI_PREFIX.bytesize..]
      else
        spki
      end
    end

    # Base64url encode (no padding)
    def base64url_encode(data)
      Base64.strict_encode64(data).tr("+/", "-_").gsub(/=+$/, "")
    end

    # Public key as base64url-encoded raw bytes
    def public_key_raw_base64url(public_key_pem)
      base64url_encode(derive_public_key_raw(public_key_pem))
    end

    # Sign a payload with Ed25519 private key, return base64url
    def sign_device_payload(private_key_pem, payload)
      key = OpenSSL::PKey.read(private_key_pem)
      signature = key.sign(nil, payload)
      base64url_encode(signature)
    end

    # Build the v3 device auth payload string (pipe-separated fields)
    def build_device_auth_payload_v3(device_id:, client_id:, client_mode:, role:, scopes:, signed_at_ms:, token:, nonce:, platform:, device_family:)
      [
        "v3",
        device_id,
        client_id,
        client_mode,
        role,
        scopes.join(","),
        signed_at_ms.to_s,
        token.to_s,
        nonce,
        normalize_device_metadata(platform),
        normalize_device_metadata(device_family)
      ].join("|")
    end

    def normalize_device_metadata(value)
      return "" if value.nil?
      value.to_s.strip.downcase
    end
  end
end
