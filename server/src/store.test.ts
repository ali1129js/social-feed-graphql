import { describe, expect, it } from "vitest";
import { seedData } from "./seed.js";
import { createMemoryStore, StoreError } from "./store.js";

function store() {
  return createMemoryStore(seedData(), () => "2026-11-24T08:00:00.000Z");
}

describe("in-memory store", () => {
  it("lists posts newest first without mutating the seed module", () => {
    const a = store();
    a.createPost({ authorId: "user_1", body: "Only in store A" });
    const b = store();
    expect(a.listPostsNewestFirst()[0]?.body).toBe("Only in store A");
    expect(b.listPostsNewestFirst()[0]?.id).toBe("post_8");
    expect(seedData().posts).toHaveLength(8);
  });

  it("looks up a user by handle case-insensitively", () => {
    expect(store().getUserByHandle("Maya")?.id).toBe("user_1");
    expect(store().getUserByHandle("nobody")).toBeUndefined();
  });

  it("cascades comments and likes when a post is deleted", () => {
    const s = store();
    expect(s.listComments("post_1").length).toBeGreaterThan(0);
    expect(s.listLikes("post_1").length).toBeGreaterThan(0);
    expect(s.deletePost("post_1")).toBe(true);
    expect(s.getPost("post_1")).toBeUndefined();
    expect(s.listComments("post_1")).toEqual([]);
    expect(s.listLikes("post_1")).toEqual([]);
  });

  it("throws when creating a post for a missing user", () => {
    expect(() => store().createPost({ authorId: "user_999", body: "Hello" })).toThrow(StoreError);
  });

  it("refuses a second like from the same user", () => {
    const s = store();
    expect(() => s.addLike({ userId: "user_2", postId: "post_1" })).toThrow(/already liked/i);
  });
});
