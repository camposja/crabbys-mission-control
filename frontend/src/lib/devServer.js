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
  return LOOPBACK_HOSTS.has(normalizeHost(host));
}

/**
 * @param {Record<string,string>} env process env / loadEnv result
 * @returns {string} host to bind the Vite server to
 * @throws {Error} when VITE_BIND is non-loopback without VITE_ENABLE_LAN_MODE=true
 */
/**
 * Enforces the policy against a RESOLVED Vite host value, which may be a string,
 * `true` (Vite's "all interfaces", what a bare `--host` means) or undefined
 * (Vite's implicit localhost default).
 *
 * @param {string|boolean|undefined} host resolved server.host / preview.host
 * @param {Record<string,string>} env
 * @param {string} kind "dev server" | "preview server", used in the message
 * @throws {Error} when the resolved host is non-loopback without opt-in
 */
export function assertResolvedHostAllowed(host, env = {}, kind = "dev server") {
  if (host === undefined || host === false || host === "") return host; // Vite default: localhost
  if (host !== true && isLoopbackHost(host)) return host;
  if (lanHostAuthorized(host, env)) return host;

  const shown = host === true ? "--host (all interfaces)" : `--host ${host}`;
  const bind = String(env.VITE_BIND ?? "").trim() || "(unset)";
  const flag = String(env.VITE_ENABLE_LAN_MODE ?? "").trim() || "(unset)";
  throw new Error(
    `Refusing to start: ${shown} would serve Mission Control beyond this machine. ` +
      `Bind the ${kind} to 127.0.0.1 instead. Serving a LAN interface takes BOTH keys, ` +
      "and they must agree: VITE_BIND=<the same host> and VITE_ENABLE_LAN_MODE=true " +
      `(currently VITE_BIND=${bind}, VITE_ENABLE_LAN_MODE=${flag}).`
  );
}

/**
 * Two keys, and they have to agree.
 *
 * The flag alone is NOT enough: VITE_ENABLE_LAN_MODE=true plus `vite --host 0.0.0.0`
 * used to be accepted, which let a command-line flag decide the exposure. The
 * operator must also have declared the interface in VITE_BIND, and it must be the
 * host actually being served — so VITE_BIND=0.0.0.0 does not authorise serving a
 * LAN address, and vice versa. A bare `--host` (Vite's `true`, meaning every
 * interface) names no host at all, so it can never match and is always refused.
 */
function lanHostAuthorized(host, env) {
  if (host === true) return false;
  if (env.VITE_ENABLE_LAN_MODE !== "true") return false;

  const declared = String(env.VITE_BIND ?? "").trim();
  if (!declared) return false;

  return normalizeHost(declared) === normalizeHost(host);
}

// "[::1]" -> "::1", " 0.0.0.0 " -> "0.0.0.0"
function normalizeHost(host) {
  return String(host ?? "").trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
}

/**
 * Vite plugin that re-checks the FINAL resolved dev/preview configuration.
 *
 * `server.host` in vite.config.js is not enough on its own: a CLI `--host` /
 * `--host 0.0.0.0` overrides it, as does an inline config. `configResolved`
 * runs after that merge and before any socket is opened.
 *
 * @param {Record<string,string>} env
 */
export function loopbackGuardPlugin(env = {}) {
  return {
    name: "mission-control:loopback-guard",
    configResolved(config) {
      if (config.command !== "serve") return; // `vite build` never listens
      // Check both: `vite` uses server.host, `vite preview` uses preview.host,
      // and the resolved config does not reliably say which one is about to run.
      assertResolvedHostAllowed(config.server?.host, env, "dev server");
      assertResolvedHostAllowed(config.preview?.host, env, "preview server");
    },
  };
}

export function resolveDevServerHost(env = {}) {
  const requested = String(env.VITE_BIND || "").trim();
  if (!requested) return DEFAULT_DEV_HOST;
  if (isLoopbackHost(requested)) return requested;

  if (!lanHostAuthorized(requested, env)) {
    throw new Error(
      `VITE_BIND=${requested} would serve Mission Control beyond this machine. ` +
        "Refusing to start. Use the default 127.0.0.1, or opt in deliberately with " +
        "VITE_BIND plus VITE_ENABLE_LAN_MODE=true on a trusted network only."
    );
  }
  return requested;
}
