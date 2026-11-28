import { describe, expect, it } from "vitest";
import { createStoreFromEnv } from "./create-store.js";

describe("createStoreFromEnv", () => {
  it("uses the in-memory store with demo data when DATABASE_URL is missing or blank", async () => {
    for (const env of [{}, { DATABASE_URL: "" }, { DATABASE_URL: "   " }]) {
      const handle = createStoreFromEnv(env);
      expect(handle.kind).toBe("memory");
      expect((await handle.store.listUsers()).length).toBe(5);
      await handle.close();
    }
  });

  it("picks Postgres when DATABASE_URL is set, without connecting until first use", async () => {
    // postgres-js connects lazily, so a placeholder URL is safe here. No query is sent.
    const handle = createStoreFromEnv({ DATABASE_URL: "postgres://user:pass@127.0.0.1:1/none" });
    expect(handle.kind).toBe("postgres");
    await handle.close();
  });
});
