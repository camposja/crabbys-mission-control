import { describe, it, expect } from "vitest";
import { resolveDevServerHost, isLoopbackHost, DEFAULT_DEV_HOST } from "./devServer";

describe("resolveDevServerHost", () => {
  it("defaults to explicit loopback with no env", () => {
    expect(resolveDevServerHost()).toBe("127.0.0.1");
    expect(resolveDevServerHost({})).toBe(DEFAULT_DEV_HOST);
    expect(resolveDevServerHost({ VITE_BIND: "  " })).toBe("127.0.0.1");
  });

  it("accepts loopback hosts without opt-in", () => {
    for (const host of ["127.0.0.1", "localhost", "::1", "[::1]"]) {
      expect(resolveDevServerHost({ VITE_BIND: host })).toBe(host);
    }
  });

  it("refuses a LAN bind without VITE_ENABLE_LAN_MODE", () => {
    for (const host of ["0.0.0.0", "::", "192.168.1.20"]) {
      expect(() => resolveDevServerHost({ VITE_BIND: host })).toThrow(/Refusing to start/);
    }
  });

  it("refuses a LAN bind when the flag is not exactly \"true\"", () => {
    for (const flag of ["1", "yes", "TRUE", "false"]) {
      expect(() =>
        resolveDevServerHost({ VITE_BIND: "0.0.0.0", VITE_ENABLE_LAN_MODE: flag })
      ).toThrow();
    }
  });

  it("allows a LAN bind only when both opt-ins are explicit", () => {
    expect(
      resolveDevServerHost({ VITE_BIND: "0.0.0.0", VITE_ENABLE_LAN_MODE: "true" })
    ).toBe("0.0.0.0");
  });

  it("does not bind to a LAN interface from VITE_ENABLE_LAN_MODE alone", () => {
    expect(resolveDevServerHost({ VITE_ENABLE_LAN_MODE: "true" })).toBe("127.0.0.1");
  });
});

describe("isLoopbackHost", () => {
  it("classifies hosts", () => {
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("LOCALHOST")).toBe(true);
    expect(isLoopbackHost("0.0.0.0")).toBe(false);
    expect(isLoopbackHost("")).toBe(false);
  });
});
