import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export interface PostgresConnection {
  db: ReturnType<typeof createDrizzle>;
  close(): Promise<void>;
}

function createDrizzle(client: postgres.Sql) {
  return drizzle(client, { schema });
}

/**
 * Connects with postgres-js over TCP. Works with Neon (use the connection string
 * from the Neon dashboard, it already carries sslmode=require). `prepare: false`
 * keeps it compatible with Neon's pooled (pgbouncer) endpoint.
 */
export function connectPostgres(url: string): PostgresConnection {
  const client = postgres(url, {
    max: 5,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
  });
  return { db: createDrizzle(client), close: () => client.end({ timeout: 5 }) };
}
