import process from "node:process";
import { describe, it, expect } from "vitest";
import { resolveConfig } from "vite";
import {
  resolveDevServerHost,
  isLoopbackHost,
  assertResolvedHostAllowed,
  loopbackGuardPlugin,
  DEFAULT_DEV_HOST,
} from "./devServer";

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

  it("keeps dev and preview working on the default and on loopback overrides", () => {
    expect(resolveDevServerHost({})).toBe("127.0.0.1");
    expect(resolveDevServerHost({ VITE_BIND: "::1" })).toBe("::1");
    expect(resolveDevServerHost({ VITE_BIND: "localhost" })).toBe("localhost");
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

describe("assertResolvedHostAllowed", () => {
  it("allows loopback and Vite's implicit default", () => {
    for (const host of ["127.0.0.1", "localhost", "::1", "[::1]", undefined, false, ""]) {
      expect(() => assertResolvedHostAllowed(host, {})).not.toThrow();
    }
  });

  it("refuses `--host` with no value (Vite's all-interfaces `true`)", () => {
    expect(() => assertResolvedHostAllowed(true, {})).toThrow(/all interfaces/);
  });

  it("refuses a non-loopback host from a CLI override", () => {
    for (const host of ["0.0.0.0", "::", "192.168.4.158"]) {
      expect(() => assertResolvedHostAllowed(host, {})).toThrow(/Refusing to start/);
    }
  });

  // Two keys, and they have to agree. The flag on its own used to be enough,
  // which let `vite --host 0.0.0.0` decide the exposure by itself.
  it("rejects the LAN flag alone plus a CLI host", () => {
    expect(() => assertResolvedHostAllowed("0.0.0.0", { VITE_ENABLE_LAN_MODE: "true" }))
      .toThrow(/BOTH keys/);
  });

  it("rejects VITE_BIND alone", () => {
    expect(() => assertResolvedHostAllowed("0.0.0.0", { VITE_BIND: "0.0.0.0" })).toThrow();
  });

  it("rejects a VITE_BIND that does not match the final host", () => {
    expect(() =>
      assertResolvedHostAllowed("192.168.4.158", { VITE_BIND: "0.0.0.0", VITE_ENABLE_LAN_MODE: "true" })
    ).toThrow();
    expect(() =>
      assertResolvedHostAllowed("0.0.0.0", { VITE_BIND: "192.168.4.158", VITE_ENABLE_LAN_MODE: "true" })
    ).toThrow();
  });

  it("rejects a blank or missing VITE_BIND even with the flag", () => {
    for (const bind of ["", "   ", undefined]) {
      expect(() =>
        assertResolvedHostAllowed("0.0.0.0", { VITE_BIND: bind, VITE_ENABLE_LAN_MODE: "true" })
      ).toThrow();
    }
  });

  it("requires the flag to be exactly \"true\"", () => {
    for (const flag of ["1", "yes", "TRUE", "True", " true "]) {
      expect(() =>
        assertResolvedHostAllowed("0.0.0.0", { VITE_BIND: "0.0.0.0", VITE_ENABLE_LAN_MODE: flag })
      ).toThrow();
    }
  });

  it("rejects a bare --host (wildcard) even when both keys are set", () => {
    expect(() =>
      assertResolvedHostAllowed(true, { VITE_BIND: "0.0.0.0", VITE_ENABLE_LAN_MODE: "true" })
    ).toThrow(/all interfaces/);
  });

  it("allows an intentional LAN bind when both keys agree", () => {
    expect(assertResolvedHostAllowed("0.0.0.0", { VITE_BIND: "0.0.0.0", VITE_ENABLE_LAN_MODE: "true" }))
      .toBe("0.0.0.0");
    expect(assertResolvedHostAllowed("192.168.4.158", { VITE_BIND: "192.168.4.158", VITE_ENABLE_LAN_MODE: "true" }))
      .toBe("192.168.4.158");
    // IPv6, with and without brackets on either side
    expect(assertResolvedHostAllowed("[::]", { VITE_BIND: "::", VITE_ENABLE_LAN_MODE: "true" })).toBe("[::]");
    expect(assertResolvedHostAllowed("::", { VITE_BIND: "[::]", VITE_ENABLE_LAN_MODE: "true" })).toBe("::");
  });
});

describe("loopbackGuardPlugin", () => {
  const plugin = (env) => loopbackGuardPlugin(env);

  it("checks server.host when serving", () => {
    expect(() =>
      plugin({}).configResolved({ command: "serve", server: { host: "0.0.0.0" } })
    ).toThrow(/dev server/);
  });

  it("checks preview.host too — the resolved config does not say which will run", () => {
    expect(() =>
      plugin({}).configResolved({
        command: "serve",
        server: { host: "127.0.0.1" },
        preview: { host: "0.0.0.0" },
      })
    ).toThrow(/preview server/);
  });

  it("rejects the LAN flag alone through the resolved dev config", () => {
    expect(() =>
      plugin({ VITE_ENABLE_LAN_MODE: "true" }).configResolved({
        command: "serve",
        server: { host: "0.0.0.0" },
      })
    ).toThrow(/BOTH keys/);
  });

  it("allows dev and preview when both keys agree", () => {
    const env = { VITE_BIND: "0.0.0.0", VITE_ENABLE_LAN_MODE: "true" };
    expect(() =>
      plugin(env).configResolved({
        command: "serve",
        server: { host: "0.0.0.0" },
        preview: { host: "0.0.0.0" },
      })
    ).not.toThrow();
  });

  it("ignores builds, which never listen", () => {
    expect(() =>
      plugin({}).configResolved({ command: "build", server: { host: "0.0.0.0" } })
    ).not.toThrow();
  });
});

// End-to-end against the real vite.config.js: resolveConfig performs the same
// CLI/inline merge `vite --host 0.0.0.0` does, and runs configResolved hooks.
// Nothing is served — no socket is opened by resolveConfig.
describe("vite.config.js resolved configuration", () => {
  it("resolves the dev server to loopback by default", async () => {
    const config = await resolveConfig({ root: process.cwd() }, "serve");
    expect(config.server.host).toBe("127.0.0.1");
  });

  it("refuses a `--host 0.0.0.0` CLI override", async () => {
    await expect(
      resolveConfig({ root: process.cwd(), server: { host: "0.0.0.0" } }, "serve")
    ).rejects.toThrow(/Refusing to start/);
  });

  it("refuses a bare `--host` CLI override", async () => {
    await expect(
      resolveConfig({ root: process.cwd(), server: { host: true } }, "serve")
    ).rejects.toThrow(/Refusing to start/);
  });

  it("refuses a `--host 0.0.0.0` override on preview", async () => {
    await expect(
      resolveConfig({ root: process.cwd(), preview: { host: "0.0.0.0" } }, "serve", "development", "development", true)
    ).rejects.toThrow(/preview server/);
  });

  it("still allows a build regardless of host flags", async () => {
    const config = await resolveConfig({ root: process.cwd(), server: { host: "0.0.0.0" } }, "build");
    expect(config.command).toBe("build");
  });
});
