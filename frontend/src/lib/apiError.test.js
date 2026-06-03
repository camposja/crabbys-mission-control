import { describe, it, expect } from "vitest";
import { describeApiError } from "./apiError";

describe("describeApiError", () => {
  it("flags a network error and includes the backend target", () => {
    const d = describeApiError(
      { code: "ERR_NETWORK", message: "Network Error", config: { url: "/courses" } },
      { apiBase: "http://localhost:3000/api/v1" },
    );
    expect(d.isNetwork).toBe(true);
    expect(d.status).toBe(0);
    expect(d.url).toBe("/courses");
    expect(d.apiBase).toBe("http://localhost:3000/api/v1");
    expect(d.hint).toMatch(/CORS|offline|URL/);
  });

  it("surfaces the backend error text and structured details on 422", () => {
    const d = describeApiError({
      config: { url: "/courses/bulk_upsert" },
      response: {
        status: 422,
        data: {
          error: "Bulk upsert failed",
          details: [{ entity: "note", path: "courses[0].notes[0]", message: "Body can't be blank" }],
        },
      },
    });
    expect(d.status).toBe(422);
    expect(d.message).toBe("Bulk upsert failed");
    expect(d.details).toHaveLength(1);
    expect(d.details[0].path).toBe("courses[0].notes[0]");
  });

  it("uses a safe generic message for 5xx but keeps status/target", () => {
    const d = describeApiError({
      config: { url: "/projects" },
      response: { status: 500, data: { error: "PG::Boom secret stacktrace" } },
    });
    expect(d.status).toBe(500);
    expect(d.message).toBe("Server error");
    expect(d.message).not.toMatch(/secret/);
    expect(d.url).toBe("/projects");
  });

  it("falls back to the configured API base when no context given", () => {
    const d = describeApiError({ code: "ERR_NETWORK" });
    expect(d.apiBase).toMatch(/\/api\/v1$/);
  });
});
