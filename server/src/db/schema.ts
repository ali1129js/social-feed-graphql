import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Tables use serial integer keys. The API still exposes ids like "post_8"
 * (see `ids.ts`), so clients and cursors are unchanged from the in-memory store.
 */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    handle: text("handle").notNull(),
    displayName: text("display_name").notNull(),
  },
  (t) => [
    // Handles are looked up case-insensitively, so uniqueness is too.
    uniqueIndex("users_handle_lower_uq").on(sql`lower(${t.handle})`),
  ],
);

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    // Kept in step with the likes table inside one transaction (see store-postgres.ts).
    likeCount: integer("like_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (t) => [
    // Keyset pagination: ORDER BY created_at DESC, id DESC, with a (created_at, id) cursor.
    index("posts_created_at_id_idx").on(t.createdAt.desc(), t.id.desc()),
    index("posts_author_id_idx").on(t.authorId),
    check("posts_like_count_nonneg", sql`${t.likeCount} >= 0`),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (t) => [index("comments_post_created_idx").on(t.postId, t.createdAt, t.id)],
);

export const likes = pgTable(
  "likes",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (t) => [
    // One like per user and post. This also serves lookups by (post, user).
    uniqueIndex("likes_post_user_uq").on(t.postId, t.userId),
    index("likes_user_id_idx").on(t.userId),
  ],
);

export const tables = { users, posts, comments, likes };
