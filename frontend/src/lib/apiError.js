import { API_URL } from "./config";

// Normalize an Axios error into a small, consistent shape for the UI.
// Always includes the configured backend target so stale-URL / offline issues
// are obvious. Pure — safe to unit test.
//
// @returns {{status:number, message:string, url:(string|null), apiBase:string,
//            hint:(string|null), isNetwork:boolean, details:Array}}
export function describeApiError(error, context = {}) {
  const apiBase = context.apiBase || API_URL;
  const url = error?.config?.url || context.url || null;

  if (!error) {
    return { status: 0, message: "Unknown error", url, apiBase, hint: null, isNetwork: false, details: [] };
  }

  const response = error.response;

  // No response → network/offline/CORS (the stale-LAN-IP class of bug).
  if (!response || error.code === "ERR_NETWORK") {
    return {
      status: 0,
      message: "Backend unreachable",
      url,
      apiBase,
      hint: "It may be offline, the API URL may be wrong, or the request was blocked by CORS.",
      isNetwork: true,
      details: [],
    };
  }

  const status = response.status;
  const data = response.data || {};
  const details = Array.isArray(data.details) ? data.details : [];

  // 5xx: keep a safe generic message (don't leak server internals), but still
  // surface status + request + target for debugging.
  const message = status >= 500
    ? "Server error"
    : (data.error || data.message || error.message || `Request failed (${status})`);

  return { status, message, url, apiBase, hint: null, isNetwork: false, details };
}
