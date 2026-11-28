import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { posts } from "./db/schema.js";
import { seedDatabase } from "./db/seed-db.js";
import { seedData } from "./seed.js";
import { createPostgresStore } from "./store-postgres.js";
import { createPgliteDb, currentStoreKind } from "./testing/stores.js";

// Database-level checks: constraints, indexes, seeding. Only meaningful on Postgres.
describe.skipIf(currentStoreKind() !== "pglite")("Postgres schema and seed", () => {
  let ctx: Awaited<ReturnType<typeof createPgliteDb>>;
  beforeAll(async () => {
    ctx = await createPgliteDb();
    await seedDatabase(ctx.db, seedData());
  });
  afterAll(() => ctx.close());

  it("loads the demo data with its original ids and consistent like counters", async () => {
    const rows = await ctx.db.select({ id: posts.id, likeCount: posts.likeCount }).from(posts);
    const byId = new Map(rows.map((r) => [r.id, r.likeCount]));
    expect(byId.size).toBe(8);
    expect(byId.get(1)).toBe(2);
    expect(byId.get(8)).toBe(2);
    expect(byId.get(5)).toBe(0);
  });

  it("is safe to seed twice", async () => {
    await seedDatabase(ctx.db, seedData());
    const [row] = await ctx.db.select({ n: sql<number>`count(*)::int` }).from(posts);
    expect(row?.n).toBe(8);
  });

  it("moves the id sequences past the seeded ids", async () => {
    const store = createPostgresStore(ctx.db);
    const post = await store.createPost({ authorId: "user_1", body: "after seed" });
    expect(post.id).toBe("post_9");
    const comment = await store.createComment({ authorId: "user_1", postId: post.id, body: "c" });
    expect(comment.id).toBe("comment_6");
    const like = await store.addLike({ userId: "user_1", postId: post.id });
    expect(like.id).toBe("like_8");
  });

  it("enforces unique likes and foreign keys in the database itself", async () => {
    await expect(
      ctx.db.execute(sql`insert into likes (post_id, user_id, created_at) values (1, 2, now())`),
    ).rejects.toThrow();
    await expect(
      ctx.db.execute(sql`insert into posts (author_id, body, created_at) values (999, 'x', now())`),
    ).rejects.toThrow();
    await expect(
      ctx.db.execute(sql`update posts set like_count = -1 where id = 1`),
    ).rejects.toThrow();
  });

  it("keeps the like counter in step with the likes table through add and remove", async () => {
    const store = createPostgresStore(ctx.db);
    const like = await store.addLike({ userId: "user_5", postId: "post_5" });
    const [afterAdd] = await ctx.db.select({ n: posts.likeCount }).from(posts).where(eq(posts.id, 5));
    expect(afterAdd?.n).toBe(1);
    await store.removeLike(like.id);
    const [afterRemove] = await ctx.db.select({ n: posts.likeCount }).from(posts).where(eq(posts.id, 5));
    expect(afterRemove?.n).toBe(0);
  });

  it("does not bump the counter when a duplicate like is refused", async () => {
    const store = createPostgresStore(ctx.db);
    await expect(store.addLike({ userId: "user_2", postId: "post_1" })).rejects.toMatchObject({ code: "CONFLICT" });
    const [row] = await ctx.db.select({ n: posts.likeCount }).from(posts).where(eq(posts.id, 1));
    expect(row?.n).toBe(2);
  });

  it("survives two simultaneous likes from the same user: one wins, one conflicts", async () => {
    const store = createPostgresStore(ctx.db);
    const results = await Promise.allSettled([
      store.addLike({ userId: "user_3", postId: "post_4" }),
      store.addLike({ userId: "user_3", postId: "post_4" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await store.countLikes("post_4")).toBe(1);
  });
});
