import { afterAll, describe, expect, it } from "vitest";
import { seedData } from "./seed.js";
import { StoreError } from "./store.js";
import { createStoreFactory } from "./testing/stores.js";

// Runs once per Vitest project: against the in-memory store and against Postgres (PGlite).
const factory = createStoreFactory();
afterAll(() => factory.close());

const FIXED = () => "2026-11-24T08:00:00.000Z";
const store = () => factory.create(FIXED);

describe(`store contract (${factory.kind})`, () => {
  it("starts with the demo data and lists posts newest first", async () => {
    const s = await store();
    const page = await s.listFeedPage(50);
    expect(page.totalCount).toBe(seedData().posts.length);
    expect(page.posts[0]?.id).toBe("post_8");
    expect(page.posts.map((p) => p.createdAt)).toEqual(
      seedData()
        .posts.map((p) => p.createdAt)
        .sort()
        .reverse(),
    );
  });

  it("does not leak changes between stores or into the seed module", async () => {
    const a = await store();
    await a.createPost({ authorId: "user_1", body: "Only in store A" });
    expect((await a.listFeedPage(1)).posts[0]?.body).toBe("Only in store A");
    const b = await store();
    expect((await b.listFeedPage(1)).posts[0]?.id).toBe("post_8");
    expect(seedData().posts).toHaveLength(8);
  });

  it("looks up a user by id and by handle, case-insensitively", async () => {
    const s = await store();
    expect((await s.getUserByHandle("Maya"))?.id).toBe("user_1");
    expect((await s.getUserByHandle("  NOAH "))?.id).toBe("user_2");
    expect(await s.getUserByHandle("nobody")).toBeUndefined();
    expect((await s.getUser("user_3"))?.handle).toBe("luca");
    expect(await s.getUser("user_999")).toBeUndefined();
    expect(await s.getUser("not-an-id")).toBeUndefined();
    expect((await s.listUsers()).map((u) => u.id)).toEqual(["user_1", "user_2", "user_3", "user_4", "user_5"]);
  });

  it("creates posts with the next id, the author and the injected clock", async () => {
    const s = await store();
    const post = await s.createPost({ authorId: "user_2", body: "Hello" });
    expect(post).toEqual({ id: "post_9", authorId: "user_2", body: "Hello", createdAt: "2026-11-24T08:00:00.000Z" });
    expect(await s.getPost("post_9")).toEqual(post);
    expect(await s.getPost("post_999")).toBeUndefined();
  });

  it("throws NOT_FOUND when creating for a missing user or post", async () => {
    const s = await store();
    await expect(s.createPost({ authorId: "user_999", body: "Hello" })).rejects.toThrow(StoreError);
    await expect(s.createComment({ authorId: "user_999", postId: "post_1", body: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "User not found",
    });
    await expect(s.createComment({ authorId: "user_1", postId: "post_999", body: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Post not found",
    });
    await expect(s.addLike({ userId: "user_1", postId: "post_999" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(s.addLike({ userId: "user_999", postId: "post_1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("cascades comments and likes when a post is deleted", async () => {
    const s = await store();
    expect((await s.listComments("post_1")).length).toBeGreaterThan(0);
    expect((await s.listLikes("post_1")).length).toBeGreaterThan(0);
    expect(await s.deletePost("post_1")).toBe(true);
    expect(await s.getPost("post_1")).toBeUndefined();
    expect(await s.listComments("post_1")).toEqual([]);
    expect(await s.listLikes("post_1")).toEqual([]);
    expect(await s.deletePost("post_1")).toBe(false);
  });
});

describe(`likes (${factory.kind})`, () => {
  it("refuses a second like from the same user", async () => {
    const s = await store();
    await expect(s.addLike({ userId: "user_2", postId: "post_1" })).rejects.toThrow(/already liked/i);
    await expect(s.addLike({ userId: "user_2", postId: "post_1" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await s.countLikes("post_1")).toBe(2);
  });

  it("adds and removes a like and keeps the count right", async () => {
    const s = await store();
    expect(await s.countLikes("post_4")).toBe(0);
    expect(await s.findLike("post_4", "user_2")).toBeUndefined();
    const like = await s.addLike({ userId: "user_2", postId: "post_4" });
    expect(like.postId).toBe("post_4");
    expect(like.userId).toBe("user_2");
    expect(await s.countLikes("post_4")).toBe(1);
    expect((await s.findLike("post_4", "user_2"))?.id).toBe(like.id);
    expect((await s.listLikes("post_4")).map((l) => l.id)).toEqual([like.id]);
    expect(await s.removeLike(like.id)).toBe(true);
    expect(await s.removeLike(like.id)).toBe(false);
    expect(await s.countLikes("post_4")).toBe(0);
    // After unliking, the same user can like again.
    await s.addLike({ userId: "user_2", postId: "post_4" });
    expect(await s.countLikes("post_4")).toBe(1);
  });

  it("counts likes per post from the seed", async () => {
    const s = await store();
    expect(await s.countLikes("post_1")).toBe(2);
    expect(await s.countLikes("post_8")).toBe(2);
    expect(await s.countLikes("post_5")).toBe(0);
    expect(await s.countLikes("post_999")).toBe(0);
  });

  it("lets two different users like the same post", async () => {
    const s = await store();
    await s.addLike({ userId: "user_3", postId: "post_5" });
    await s.addLike({ userId: "user_4", postId: "post_5" });
    expect(await s.countLikes("post_5")).toBe(2);
  });
});

describe(`comments (${factory.kind})`, () => {
  it("lists comments oldest first and counts them", async () => {
    const s = await store();
    expect((await s.listComments("post_3")).map((c) => c.id)).toEqual(["comment_2", "comment_3"]);
    expect(await s.countComments("post_3")).toBe(2);
    expect(await s.countComments("post_2")).toBe(0);
    expect(await s.listComments("post_2")).toEqual([]);
  });

  it("creates, reads and deletes a comment", async () => {
    const s = await store();
    const comment = await s.createComment({ authorId: "user_4", postId: "post_2", body: "Nice" });
    expect(comment).toMatchObject({ id: "comment_6", postId: "post_2", authorId: "user_4", body: "Nice" });
    expect(await s.getComment("comment_6")).toEqual(comment);
    expect(await s.countComments("post_2")).toBe(1);
    expect(await s.deleteComment("comment_6")).toBe(true);
    expect(await s.deleteComment("comment_6")).toBe(false);
    expect(await s.getComment("comment_6")).toBeUndefined();
    expect(await s.countComments("post_2")).toBe(0);
  });
});

describe(`cursor pagination (${factory.kind})`, () => {
  it("walks the whole feed page by page without gaps or repeats", async () => {
    const s = await store();
    const seen: string[] = [];
    let after: string | undefined;
    let pages = 0;
    for (;;) {
      const page = await s.listFeedPage(3, after);
      pages += 1;
      expect(page.totalCount).toBe(8);
      expect(page.hasPreviousPage).toBe(after !== undefined);
      seen.push(...page.posts.map((p) => p.id));
      const last = page.posts[page.posts.length - 1];
      if (!page.hasNextPage || !last) break;
      after = last.id;
    }
    expect(pages).toBe(3);
    expect(seen).toEqual(["post_8", "post_7", "post_6", "post_5", "post_4", "post_3", "post_2", "post_1"]);
  });

  it("reports hasNextPage correctly on an exact fit", async () => {
    const s = await store();
    const page = await s.listFeedPage(8);
    expect(page.posts).toHaveLength(8);
    expect(page.hasNextPage).toBe(false);
    const short = await s.listFeedPage(7);
    expect(short.hasNextPage).toBe(true);
  });

  it("breaks created_at ties by id, highest first, and stays stable across pages", async () => {
    const s = await store();
    // Fixed clock: these three posts share one timestamp.
    const a = await s.createPost({ authorId: "user_1", body: "tie a" });
    const b = await s.createPost({ authorId: "user_1", body: "tie b" });
    const c = await s.createPost({ authorId: "user_1", body: "tie c" });
    const first = await s.listFeedPage(2);
    expect(first.posts.map((p) => p.id)).toEqual([c.id, b.id]);
    const second = await s.listFeedPage(2, b.id);
    expect(second.posts.map((p) => p.id)).toEqual([a.id, "post_8"]);
  });

  it("puts a new post at the top and does not shift an old cursor", async () => {
    const s = await store();
    const before = await s.listFeedPage(3);
    const cursor = before.posts[2]?.id;
    await s.createPost({ authorId: "user_5", body: "Fresh" });
    expect((await s.listFeedPage(1)).posts[0]?.body).toBe("Fresh");
    const next = await s.listFeedPage(3, cursor);
    expect(next.posts.map((p) => p.id)).toEqual(["post_5", "post_4", "post_3"]);
  });

  it("rejects an unknown, malformed or deleted cursor", async () => {
    const s = await store();
    await expect(s.listFeedPage(3, "post_999")).rejects.toMatchObject({ code: "BAD_CURSOR" });
    await expect(s.listFeedPage(3, "nope")).rejects.toMatchObject({ code: "BAD_CURSOR" });
    await s.deletePost("post_6");
    await expect(s.listFeedPage(3, "post_6")).rejects.toMatchObject({ code: "BAD_CURSOR" });
  });
});
