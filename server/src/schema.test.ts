import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

async function query(q: string) {
  const res = await createApp().fetch("http://localhost/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: q }),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe("GraphQL server", () => {
  it("answers the health query", async () => {
    const { status, body } = await query("{ health { ok service } }");
    expect(status).toBe(200);
    expect(body["data"]).toEqual({ health: { ok: true, service: "social-feed-server" } });
  });

  it("rejects unknown fields with a GraphQL error", async () => {
    const { body } = await query("{ nope }");
    expect(Array.isArray(body["errors"])).toBe(true);
  });
});
