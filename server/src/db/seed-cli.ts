import { seedData } from "../seed.js";
import { connectPostgres } from "./client.js";
import { seedDatabase } from "./seed-db.js";

const url = process.env["DATABASE_URL"];
if (!url) {
  console.error("DATABASE_URL is not set. See server/.env.example.");
  process.exit(1);
}

const { db, close } = connectPostgres(url);
try {
  await seedDatabase(db, seedData());
  console.log("Demo data loaded (fictional people and posts).");
} finally {
  await close();
}
