// Dev/preview server bind host for Vite.
//
// Mission Control is a localhost-only operator app: the Vite dev server binds
// to 127.0.0.1 explicitly rather than leaning on Vite's implicit default, so
// the loopback guarantee survives a future Vite default change.
//
// Serving the UI on a LAN interface is opt-in and takes BOTH:
//   VITE_BIND=0.0.0.0
//   VITE_ENABLE_LAN_MODE=true
// (pair with the backend's RAILS_BIND + MISSION_CONTROL_ALLOW_LAN — the API is
// what actually exposes the Terminal's shell access).

export const DEFAULT_DEV_HOST = "127.0.0.1";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);

export function isLoopbackHost(host) {
  return LOOPBACK_HOSTS.has(String(host || "").trim().toLowerCase());
}

/**
 * @param {Record<string,string>} env process env / loadEnv result
 * @returns {string} host to bind the Vite server to
 * @throws {Error} when VITE_BIND is non-loopback without VITE_ENABLE_LAN_MODE=true
 */
export function resolveDevServerHost(env = {}) {
  const requested = String(env.VITE_BIND || "").trim();
  if (!requested) return DEFAULT_DEV_HOST;
  if (isLoopbackHost(requested)) return requested;

  if (env.VITE_ENABLE_LAN_MODE !== "true") {
    throw new Error(
      `VITE_BIND=${requested} would serve Mission Control beyond this machine. ` +
        "Refusing to start. Use the default 127.0.0.1, or opt in deliberately with " +
        "VITE_ENABLE_LAN_MODE=true on a trusted network only."
    );
  }
  return requested;
}
