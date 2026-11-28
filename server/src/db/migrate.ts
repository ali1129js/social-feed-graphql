import { migrate } from "drizzle-orm/postgres-js/migrator";
import { connectPostgres } from "./client.js";

const url = process.env["DATABASE_URL"];
if (!url) {
  console.error("DATABASE_URL is not set. See server/.env.example.");
  process.exit(1);
}

const { db, close } = connectPostgres(url);
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
} finally {
  await close();
}
