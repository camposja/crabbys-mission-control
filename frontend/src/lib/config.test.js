import { describe, it, expect } from "vitest";
import { resolveBackendTarget } from "./config";

describe("resolveBackendTarget", () => {
  it("localhost host + no env → localhost URLs, not LAN", () => {
    const t = resolveBackendTarget({ hostname: "localhost", protocol: "http:", env: {} });
    expect(t.apiUrl).toBe("http://localhost:3002/api/v1");
    expect(t.cableUrl).toBe("ws://localhost:3002/cable");
    expect(t.isLanMode).toBe(false);
    expect(t.isRemoteHost).toBe(false);
  });

  it("LAN host + LAN disabled → still localhost (no silent LAN targeting)", () => {
    const t = resolveBackendTarget({ hostname: "192.168.1.20", protocol: "http:", env: {} });
    expect(t.apiUrl).toBe("http://localhost:3002/api/v1");
    expect(t.cableUrl).toBe("ws://localhost:3002/cable");
    expect(t.isLanMode).toBe(false);
    expect(t.isRemoteHost).toBe(true); // opened over the network → banner should warn
  });

  it("LAN host + LAN enabled → same-host LAN URLs", () => {
    const t = resolveBackendTarget({
      hostname: "192.168.1.20",
      protocol: "http:",
      env: { VITE_ENABLE_LAN_MODE: "true" },
    });
    expect(t.apiUrl).toBe("http://192.168.1.20:3002/api/v1");
    expect(t.cableUrl).toBe("ws://192.168.1.20:3002/cable");
    expect(t.backendOrigin).toBe("http://192.168.1.20:3002");
    expect(t.isLanMode).toBe(true);
  });

  it("https LAN host + LAN enabled → wss cable", () => {
    const t = resolveBackendTarget({
      hostname: "box.tailnet.ts.net",
      protocol: "https:",
      env: { VITE_ENABLE_LAN_MODE: "true" },
    });
    expect(t.apiUrl).toBe("https://box.tailnet.ts.net:3002/api/v1");
    expect(t.cableUrl).toBe("wss://box.tailnet.ts.net:3002/cable");
  });

  it("explicit VITE_API_URL / VITE_CABLE_URL override everything", () => {
    const t = resolveBackendTarget({
      hostname: "192.168.1.20",
      protocol: "http:",
      env: {
        VITE_ENABLE_LAN_MODE: "true",
        VITE_API_URL: "http://10.0.0.9:4000/api/v1",
        VITE_CABLE_URL: "ws://10.0.0.9:4000/cable",
      },
    });
    expect(t.apiUrl).toBe("http://10.0.0.9:4000/api/v1");
    expect(t.cableUrl).toBe("ws://10.0.0.9:4000/cable");
    expect(t.backendOrigin).toBe("http://10.0.0.9:4000");
  });

  it("explicit LAN VITE_API_URL from a localhost page still flags LAN mode (warn)", () => {
    const t = resolveBackendTarget({
      hostname: "localhost",
      protocol: "http:",
      env: { VITE_API_URL: "http://192.168.1.50:3002/api/v1" },
    });
    expect(t.backendHost).toBe("192.168.1.50");
    expect(t.isLanMode).toBe(true);   // resolved backend is remote → banner warns
    expect(t.isRemoteHost).toBe(false); // page itself was loopback
  });

  it("VITE_BIND alone does not retarget the API away from localhost", () => {
    const t = resolveBackendTarget({
      hostname: "192.168.1.20",
      protocol: "http:",
      env: { VITE_BIND: "0.0.0.0" },
    });
    expect(t.apiUrl).toBe("http://localhost:3002/api/v1");
    expect(t.cableUrl).toBe("ws://localhost:3002/cable");
    expect(t.isLanMode).toBe(false);
  });

  it("explicit localhost override is not LAN mode", () => {
    const t = resolveBackendTarget({
      hostname: "localhost",
      protocol: "http:",
      env: { VITE_API_URL: "http://localhost:4000/api/v1" },
    });
    expect(t.isLanMode).toBe(false);
  });
});
