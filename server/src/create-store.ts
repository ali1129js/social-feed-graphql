import { connectPostgres } from "./db/client.js";
import { seedData } from "./seed.js";
import { createMemoryStore } from "./store.js";
import type { Store } from "./store.js";
import { createPostgresStore } from "./store-postgres.js";

export interface StoreHandle {
  store: Store;
  kind: "postgres" | "memory";
  close(): Promise<void>;
}

/** DATABASE_URL set: Postgres. Otherwise the in-memory store with the demo data. */
export function createStoreFromEnv(env: Record<string, string | undefined> = process.env): StoreHandle {
  const url = env["DATABASE_URL"]?.trim();
  if (url) {
    const { db, close } = connectPostgres(url);
    return { store: createPostgresStore(db), kind: "postgres", close };
  }
  return { store: createMemoryStore(seedData()), kind: "memory", close: async () => {} };
}
