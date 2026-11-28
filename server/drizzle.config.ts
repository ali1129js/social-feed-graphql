import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` only reads the schema, so no database is needed to create migrations.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env["DATABASE_URL"] ?? "" },
});
