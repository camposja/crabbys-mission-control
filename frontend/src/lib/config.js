function defaultOrigin() {
  if (typeof window === "undefined") {
    return { http: "http://localhost:3000", ws: "ws://localhost:3000" };
  }
  const { protocol, hostname } = window.location;
  const isLoopback = hostname === "localhost" || hostname === "127.0.0.1";
  const host = isLoopback ? "localhost" : hostname;
  const isHttps = protocol === "https:";
  return {
    http: `${isHttps ? "https" : "http"}://${host}:3000`,
    ws:   `${isHttps ? "wss"   : "ws"}://${host}:3000`,
  };
}

const origin = defaultOrigin();

export const API_URL   = import.meta.env.VITE_API_URL   || `${origin.http}/api/v1`;
export const CABLE_URL = import.meta.env.VITE_CABLE_URL || `${origin.ws}/cable`;
