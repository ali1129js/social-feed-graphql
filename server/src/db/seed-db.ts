import { sql } from "drizzle-orm";
import type { SeedData } from "../types.js";
import { parseId } from "./ids.js";
import { comments, likes, posts, users } from "./schema.js";
import type { Db } from "./types.js";

function key(prefix: "user" | "post" | "comment" | "like", id: string): number {
  const n = parseId(prefix, id);
  if (n === undefined) throw new Error("Bad seed id: " + id);
  return n;
}

/**
 * Loads the fictional demo data with its original ids ("user_1", "post_8", ...).
 * Safe to run twice: rows that already exist are left alone.
 */
export async function seedDatabase(db: Db, seed: SeedData): Promise<void> {
  await db.transaction(async (tx) => {
    if (seed.users.length > 0) {
      await tx
        .insert(users)
        .values(seed.users.map((u) => ({ id: key("user", u.id), handle: u.handle, displayName: u.displayName })))
        .onConflictDoNothing();
    }
    if (seed.posts.length > 0) {
      await tx
        .insert(posts)
        .values(
          seed.posts.map((p) => ({
            id: key("post", p.id),
            authorId: key("user", p.authorId),
            body: p.body,
            createdAt: new Date(p.createdAt),
          })),
        )
        .onConflictDoNothing();
    }
    if (seed.comments.length > 0) {
      await tx
        .insert(comments)
        .values(
          seed.comments.map((c) => ({
            id: key("comment", c.id),
            postId: key("post", c.postId),
            authorId: key("user", c.authorId),
            body: c.body,
            createdAt: new Date(c.createdAt),
          })),
        )
        .onConflictDoNothing();
    }
    if (seed.likes.length > 0) {
      await tx
        .insert(likes)
        .values(
          seed.likes.map((l) => ({
            id: key("like", l.id),
            postId: key("post", l.postId),
            userId: key("user", l.userId),
            createdAt: new Date(l.createdAt),
          })),
        )
        .onConflictDoNothing();
    }
    // Rows were inserted with explicit ids, so move each sequence past the highest id.
    for (const table of ["users", "posts", "comments", "likes"] as const) {
      await tx.execute(
        sql`select setval(pg_get_serial_sequence(${table}, 'id'), greatest((select coalesce(max(id), 0) from ${sql.identifier(table)}), 1), (select count(*) > 0 from ${sql.identifier(table)}))`,
      );
    }
    // Make the denormalised counter match the likes table.
    await tx.execute(
      sql`update posts set like_count = (select count(*)::int from likes where likes.post_id = posts.id)`,
    );
  });
}
