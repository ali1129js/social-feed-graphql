import { and, asc, count, eq, sql } from "drizzle-orm";
import { formatId, parseId } from "./db/ids.js";
import { comments, likes, posts, users } from "./db/schema.js";
import type { Db } from "./db/types.js";
import { StoreError } from "./store.js";
import type { FeedPage, Store } from "./store.js";
import type { CommentRecord, LikeRecord, PostRecord, UserRecord } from "./types.js";

const FOREIGN_KEY_VIOLATION = "23503";

/** Drizzle wraps driver errors, so look at the error and at its cause. */
function sqlState(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && typeof current === "object" && current !== null; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

const toUser = (row: typeof users.$inferSelect): UserRecord => ({
  id: formatId("user", row.id),
  handle: row.handle,
  displayName: row.displayName,
});

const toPost = (row: typeof posts.$inferSelect): PostRecord => ({
  id: formatId("post", row.id),
  authorId: formatId("user", row.authorId),
  body: row.body,
  createdAt: row.createdAt.toISOString(),
});

const toComment = (row: typeof comments.$inferSelect): CommentRecord => ({
  id: formatId("comment", row.id),
  postId: formatId("post", row.postId),
  authorId: formatId("user", row.authorId),
  body: row.body,
  createdAt: row.createdAt.toISOString(),
});

const toLike = (row: typeof likes.$inferSelect): LikeRecord => ({
  id: formatId("like", row.id),
  postId: formatId("post", row.postId),
  userId: formatId("user", row.userId),
  createdAt: row.createdAt.toISOString(),
});

/**
 * Postgres implementation of the same Store the in-memory version provides.
 * `now` is injectable so tests can fix timestamps.
 */
export function createPostgresStore(
  db: Db,
  now: () => string = () => new Date().toISOString(),
): Store {
  const stamp = () => new Date(now());

  return {
    async listUsers() {
      const rows = await db.select().from(users).orderBy(asc(users.id));
      return rows.map(toUser);
    },

    async getUser(id) {
      const key = parseId("user", id);
      if (key === undefined) return undefined;
      const [row] = await db.select().from(users).where(eq(users.id, key));
      return row ? toUser(row) : undefined;
    },

    async getUserByHandle(handle) {
      const needle = handle.trim().toLowerCase();
      const [row] = await db.select().from(users).where(sql`lower(${users.handle}) = ${needle}`);
      return row ? toUser(row) : undefined;
    },

    async listFeedPage(first, after): Promise<FeedPage> {
      let cursorKey: number | undefined;
      if (after !== undefined) {
        cursorKey = parseId("post", after);
        if (cursorKey === undefined) throw new StoreError("Invalid cursor", "BAD_CURSOR");
        const [exists] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, cursorKey));
        if (!exists) throw new StoreError("Invalid cursor", "BAD_CURSOR");
      }
      // Keyset pagination: rows strictly after the cursor row in (created_at DESC, id DESC) order.
      // The subquery reads the cursor row's exact timestamp, so no precision is lost.
      const afterCursor =
        cursorKey === undefined
          ? undefined
          : sql`(${posts.createdAt}, ${posts.id}) < (select p.created_at, p.id from posts p where p.id = ${cursorKey})`;
      const rows = await db
        .select()
        .from(posts)
        .where(afterCursor)
        .orderBy(sql`${posts.createdAt} desc nulls last`, sql`${posts.id} desc nulls last`)
        .limit(first + 1);
      const [total] = await db.select({ n: count() }).from(posts);
      return {
        posts: rows.slice(0, first).map(toPost),
        hasNextPage: rows.length > first,
        hasPreviousPage: cursorKey !== undefined,
        totalCount: total?.n ?? 0,
      };
    },

    async getPost(id) {
      const key = parseId("post", id);
      if (key === undefined) return undefined;
      const [row] = await db.select().from(posts).where(eq(posts.id, key));
      return row ? toPost(row) : undefined;
    },

    async createPost(input) {
      const authorKey = parseId("user", input.authorId);
      if (authorKey === undefined) throw new StoreError("User not found", "NOT_FOUND");
      try {
        const [row] = await db
          .insert(posts)
          .values({ authorId: authorKey, body: input.body, createdAt: stamp() })
          .returning();
        if (!row) throw new Error("Insert returned no row");
        return toPost(row);
      } catch (error) {
        if (sqlState(error) === FOREIGN_KEY_VIOLATION) throw new StoreError("User not found", "NOT_FOUND");
        throw error;
      }
    },

    async deletePost(id) {
      const key = parseId("post", id);
      if (key === undefined) return false;
      // Comments and likes go with the post through ON DELETE CASCADE.
      const rows = await db.delete(posts).where(eq(posts.id, key)).returning({ id: posts.id });
      return rows.length > 0;
    },

    async listComments(postId) {
      const key = parseId("post", postId);
      if (key === undefined) return [];
      const rows = await db
        .select()
        .from(comments)
        .where(eq(comments.postId, key))
        .orderBy(asc(comments.createdAt), asc(comments.id));
      return rows.map(toComment);
    },

    async countComments(postId) {
      const key = parseId("post", postId);
      if (key === undefined) return 0;
      const [row] = await db.select({ n: count() }).from(comments).where(eq(comments.postId, key));
      return row?.n ?? 0;
    },

    async getComment(id) {
      const key = parseId("comment", id);
      if (key === undefined) return undefined;
      const [row] = await db.select().from(comments).where(eq(comments.id, key));
      return row ? toComment(row) : undefined;
    },

    async createComment(input) {
      const authorKey = parseId("user", input.authorId);
      if (authorKey === undefined) throw new StoreError("User not found", "NOT_FOUND");
      const postKey = parseId("post", input.postId);
      if (postKey === undefined) throw new StoreError("Post not found", "NOT_FOUND");
      try {
        const [row] = await db
          .insert(comments)
          .values({ postId: postKey, authorId: authorKey, body: input.body, createdAt: stamp() })
          .returning();
        if (!row) throw new Error("Insert returned no row");
        return toComment(row);
      } catch (error) {
        if (sqlState(error) === FOREIGN_KEY_VIOLATION) {
          const [post] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postKey));
          throw new StoreError(post ? "User not found" : "Post not found", "NOT_FOUND");
        }
        throw error;
      }
    },

    async deleteComment(id) {
      const key = parseId("comment", id);
      if (key === undefined) return false;
      const rows = await db.delete(comments).where(eq(comments.id, key)).returning({ id: comments.id });
      return rows.length > 0;
    },

    async listLikes(postId) {
      const key = parseId("post", postId);
      if (key === undefined) return [];
      const rows = await db.select().from(likes).where(eq(likes.postId, key)).orderBy(asc(likes.id));
      return rows.map(toLike);
    },

    async countLikes(postId) {
      const key = parseId("post", postId);
      if (key === undefined) return 0;
      const [row] = await db.select({ n: posts.likeCount }).from(posts).where(eq(posts.id, key));
      return row?.n ?? 0;
    },

    async findLike(postId, userId) {
      const postKey = parseId("post", postId);
      const userKey = parseId("user", userId);
      if (postKey === undefined || userKey === undefined) return undefined;
      const [row] = await db
        .select()
        .from(likes)
        .where(and(eq(likes.postId, postKey), eq(likes.userId, userKey)));
      return row ? toLike(row) : undefined;
    },

    async addLike(input) {
      const userKey = parseId("user", input.userId);
      if (userKey === undefined) throw new StoreError("User not found", "NOT_FOUND");
      const postKey = parseId("post", input.postId);
      if (postKey === undefined) throw new StoreError("Post not found", "NOT_FOUND");
      try {
        // The like row and the counter change together or not at all.
        const row = await db.transaction(async (tx) => {
          const [inserted] = await tx
            .insert(likes)
            .values({ postId: postKey, userId: userKey, createdAt: stamp() })
            .onConflictDoNothing({ target: [likes.postId, likes.userId] })
            .returning();
          if (!inserted) return undefined;
          await tx
            .update(posts)
            .set({ likeCount: sql`${posts.likeCount} + 1` })
            .where(eq(posts.id, postKey));
          return inserted;
        });
        if (!row) throw new StoreError("Already liked", "CONFLICT");
        return toLike(row);
      } catch (error) {
        if (sqlState(error) === FOREIGN_KEY_VIOLATION) {
          const [post] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postKey));
          throw new StoreError(post ? "User not found" : "Post not found", "NOT_FOUND");
        }
        throw error;
      }
    },

    async removeLike(id) {
      const key = parseId("like", id);
      if (key === undefined) return false;
      return db.transaction(async (tx) => {
        const [removed] = await tx.delete(likes).where(eq(likes.id, key)).returning({ postId: likes.postId });
        if (!removed) return false;
        await tx
          .update(posts)
          .set({ likeCount: sql`greatest(${posts.likeCount} - 1, 0)` })
          .where(eq(posts.id, removed.postId));
        return true;
      });
    },
  };
}
