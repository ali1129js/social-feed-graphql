import { describe, expect, it } from "vitest";
import { createApp, parseCorsOrigins } from "./app.js";

function preflight(origin: string) {
  return new Request("http://localhost/graphql", {
    method: "OPTIONS",
    headers: {
      origin,
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type,authorization",
    },
  });
}

describe("parseCorsOrigins", () => {
  it("splits, trims and drops trailing slashes", () => {
    expect(parseCorsOrigins(" https://a.example/ , https://b.example ")).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });

  it("returns undefined for empty input", () => {
    expect(parseCorsOrigins(undefined)).toBeUndefined();
    expect(parseCorsOrigins("  ,")).toBeUndefined();
  });
});

describe("CORS allow list", () => {
  const app = createApp({ corsOrigins: ["https://ali1129js.github.io"] });

  it("allows the configured origin and the auth header", async () => {
    const res = await app.fetch(preflight("https://ali1129js.github.io"));
    expect(res.headers.get("access-control-allow-origin")).toBe("https://ali1129js.github.io");
    expect(res.headers.get("access-control-allow-headers")?.toLowerCase()).toContain("authorization");
  });

  it("does not allow other origins", async () => {
    const res = await app.fetch(preflight("https://evil.example"));
    expect(res.headers.get("access-control-allow-origin")).not.toBe("https://evil.example");
  });
});
