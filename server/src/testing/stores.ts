import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { seedDatabase } from "../db/seed-db.js";
import * as schema from "../db/schema.js";
import { seedData } from "../seed.js";
import { createMemoryStore } from "../store.js";
import type { Store } from "../store.js";
import { createPostgresStore } from "../store-postgres.js";

export type StoreKind = "memory" | "pglite";

/** Which store the current Vitest project runs against (see vitest.config.ts). */
export function currentStoreKind(): StoreKind {
  const kind = process.env["STORE_KIND"] ?? "memory";
  if (kind !== "memory" && kind !== "pglite") throw new Error("Unknown STORE_KIND: " + kind);
  return kind;
}

export interface StoreFactory {
  kind: StoreKind;
  /** A store holding exactly the demo data. Earlier stores from the same factory are reset. */
  create(now?: () => string): Promise<Store>;
  close(): Promise<void>;
}

/**
 * "memory" builds a new in-memory store each time. "pglite" runs real Postgres in
 * process (no server, no network): migrations are applied once, then every create()
 * empties the tables and loads the demo data again.
 */
export function createStoreFactory(kind: StoreKind = currentStoreKind()): StoreFactory {
  if (kind === "memory") {
    return {
      kind,
      create: async (now) => (now ? createMemoryStore(seedData(), now) : createMemoryStore(seedData())),
      close: async () => {},
    };
  }

  const client = new PGlite();
  const db = drizzle(client, { schema });
  let ready: Promise<void> | undefined;

  return {
    kind,
    async create(now) {
      ready ??= migrate(db, { migrationsFolder: "./drizzle" });
      await ready;
      await db.execute(sql`truncate table likes, comments, posts, users restart identity cascade`);
      await seedDatabase(db, seedData());
      return now ? createPostgresStore(db, now) : createPostgresStore(db);
    },
    close: () => client.close(),
  };
}

/** Direct database access for tests that check constraints and sequences. */
export async function createPgliteDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return { db, close: () => client.close() };
}
