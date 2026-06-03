// Backend URL resolution for Mission Control.
//
// Default behavior is localhost-only. LAN targeting is OPT-IN via
// VITE_ENABLE_LAN_MODE=true — without it, the app always talks to
// localhost:3000 even when opened from a LAN URL (so nothing silently
// targets the LAN). Explicit VITE_API_URL / VITE_CABLE_URL always win.

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", ""]);

function isLoopbackHost(host) {
  return LOOPBACK_HOSTS.has((host || "").toLowerCase());
}

// Parse the host out of a URL; falls back to a regex for non-absolute inputs.
function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    const m = String(url).match(/^[a-z]+:\/\/([^/:]+)/i);
    return m ? m[1] : "";
  }
}

/**
 * Pure, testable resolver.
 * @param {{hostname?: string, protocol?: string, env?: Record<string,string>}} input
 * @returns {{apiUrl:string, cableUrl:string, backendHost:string, backendOrigin:string, isLanMode:boolean, isRemoteHost:boolean}}
 */
export function resolveBackendTarget({ hostname, protocol, env } = {}) {
  const e = env || {};
  const lanEnabled = e.VITE_ENABLE_LAN_MODE === "true";
  const isRemoteHost = !isLoopbackHost(hostname);

  // Only target the page's own host when LAN mode is explicitly enabled.
  const derivedHost = (lanEnabled && isRemoteHost) ? hostname : "localhost";
  const isHttps = protocol === "https:";
  const httpOrigin = `${isHttps ? "https" : "http"}://${derivedHost}:3000`;
  const wsOrigin = `${isHttps ? "wss" : "ws"}://${derivedHost}:3000`;

  const apiUrl = e.VITE_API_URL || `${httpOrigin}/api/v1`;
  const cableUrl = e.VITE_CABLE_URL || `${wsOrigin}/cable`;

  // The actual backend host — reflects an explicit VITE_API_URL override.
  const backendHost = hostOf(apiUrl) || derivedHost;

  return {
    apiUrl,
    cableUrl,
    backendHost,
    backendOrigin: apiUrl.replace(/\/api\/v1\/?$/, ""),
    // LAN mode = the *resolved backend* is a non-loopback host, whether that
    // came from the flag+page-host or from an explicit VITE_API_URL override.
    isLanMode: !isLoopbackHost(backendHost),
    isRemoteHost,
  };
}

function currentEnv() {
  return (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : {};
}

const loc = (typeof window !== "undefined" && window.location)
  ? window.location
  : { hostname: "localhost", protocol: "http:" };

const target = resolveBackendTarget({
  hostname: loc.hostname,
  protocol: loc.protocol,
  env: currentEnv(),
});

export const API_URL = target.apiUrl;
export const CABLE_URL = target.cableUrl;

// Surfaced for the LAN warning banner (see LanWarningBanner.jsx).
export const IS_LAN_MODE = target.isLanMode;       // LAN mode on AND opened from a remote host
export const IS_REMOTE_HOST = target.isRemoteHost; // page opened from a non-loopback host
export const BACKEND_TARGET = target.backendOrigin;
