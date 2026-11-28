import { defineConfig } from "vitest/config";

const include = ["src/**/*.test.ts"];

// The same suite runs twice: against the in-memory store and against Postgres (PGlite).
export default defineConfig({
  test: {
    environment: "node",
    projects: [
      { test: { name: "memory", environment: "node", include, env: { STORE_KIND: "memory" } } },
      {
        test: {
          name: "pglite",
          environment: "node",
          include,
          env: { STORE_KIND: "pglite" },
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
