import type { CommentRecord, LikeRecord, PostRecord, SeedData, UserRecord } from "./types.js";

export type StoreErrorCode = "NOT_FOUND" | "CONFLICT" | "BAD_CURSOR";

export class StoreError extends Error {
  readonly code: "NOT_FOUND" | "CONFLICT" | "BAD_CURSOR";

  constructor(message: string, code: StoreErrorCode) {
    super(message);
    this.name = "StoreError";
    this.code = code;
  }
}

export interface FeedPage {
  posts: PostRecord[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalCount: number;
}

/**
 * Everything the resolvers know about storage. Methods are async so a real
 * database can sit behind them; the in-memory store just resolves immediately.
 */
export interface Store {
  listUsers(): Promise<UserRecord[]>;
  getUser(id: string): Promise<UserRecord | undefined>;
  getUserByHandle(handle: string): Promise<UserRecord | undefined>;
  /** Newest first, ties broken by id (highest first). `after` is a post id. */
  listFeedPage(first: number, after?: string): Promise<FeedPage>;
  getPost(id: string): Promise<PostRecord | undefined>;
  createPost(input: { authorId: string; body: string }): Promise<PostRecord>;
  deletePost(id: string): Promise<boolean>;
  listComments(postId: string): Promise<CommentRecord[]>;
  countComments(postId: string): Promise<number>;
  getComment(id: string): Promise<CommentRecord | undefined>;
  createComment(input: { authorId: string; postId: string; body: string }): Promise<CommentRecord>;
  deleteComment(id: string): Promise<boolean>;
  listLikes(postId: string): Promise<LikeRecord[]>;
  countLikes(postId: string): Promise<number>;
  findLike(postId: string, userId: string): Promise<LikeRecord | undefined>;
  addLike(input: { userId: string; postId: string }): Promise<LikeRecord>;
  removeLike(id: string): Promise<boolean>;
}

function copySeed(seed: SeedData): SeedData {
  return {
    users: seed.users.map((u) => ({ ...u })),
    posts: seed.posts.map((p) => ({ ...p })),
    comments: seed.comments.map((c) => ({ ...c })),
    likes: seed.likes.map((l) => ({ ...l })),
  };
}

function idNumber(id: string): number {
  const n = Number(id.slice(id.indexOf("_") + 1));
  return Number.isInteger(n) ? n : 0;
}

/** Same order as the SQL store: created_at DESC, then id DESC. */
function compareNewestFirst(a: PostRecord, b: PostRecord): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return idNumber(b.id) - idNumber(a.id);
}

function maxNumericId(items: { id: string }[], prefix: string): number {
  const head = prefix + "_";
  let max = 0;
  for (const item of items) {
    if (!item.id.startsWith(head)) continue;
    const n = Number(item.id.slice(head.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max;
}

export function createMemoryStore(
  seed: SeedData,
  now: () => string = () => new Date().toISOString(),
): Store {
  const data = copySeed(seed);
  const counters = {
    user: maxNumericId(data.users, "user"),
    post: maxNumericId(data.posts, "post"),
    comment: maxNumericId(data.comments, "comment"),
    like: maxNumericId(data.likes, "like"),
  };

  const requireUser = (id: string): UserRecord => {
    const user = data.users.find((u) => u.id === id);
    if (!user) throw new StoreError("User not found", "NOT_FOUND");
    return user;
  };

  const requirePost = (id: string): PostRecord => {
    const post = data.posts.find((p) => p.id === id);
    if (!post) throw new StoreError("Post not found", "NOT_FOUND");
    return post;
  };

  return {
    async listUsers() {
      return data.users.map((u) => ({ ...u }));
    },
    async getUser(id) {
      const user = data.users.find((u) => u.id === id);
      return user ? { ...user } : undefined;
    },
    async getUserByHandle(handle) {
      const needle = handle.trim().toLowerCase();
      const user = data.users.find((u) => u.handle.toLowerCase() === needle);
      return user ? { ...user } : undefined;
    },
    async listFeedPage(first, after) {
      const sorted = [...data.posts].sort(compareNewestFirst);
      let start = 0;
      if (after !== undefined) {
        const index = sorted.findIndex((p) => p.id === after);
        if (index === -1) throw new StoreError("Invalid cursor", "BAD_CURSOR");
        start = index + 1;
      }
      const slice = sorted.slice(start, start + first);
      return {
        posts: slice.map((p) => ({ ...p })),
        hasNextPage: start + slice.length < sorted.length,
        hasPreviousPage: start > 0,
        totalCount: sorted.length,
      };
    },
    async getPost(id) {
      const post = data.posts.find((p) => p.id === id);
      return post ? { ...post } : undefined;
    },
    async createPost(input) {
      requireUser(input.authorId);
      counters.post += 1;
      const post: PostRecord = {
        id: `post_${counters.post}`,
        authorId: input.authorId,
        body: input.body,
        createdAt: now(),
      };
      data.posts.push(post);
      return { ...post };
    },
    async deletePost(id) {
      const index = data.posts.findIndex((p) => p.id === id);
      if (index === -1) return false;
      data.posts.splice(index, 1);
      data.comments = data.comments.filter((c) => c.postId !== id);
      data.likes = data.likes.filter((l) => l.postId !== id);
      return true;
    },
    async listComments(postId) {
      return data.comments
        .filter((c) => c.postId === postId)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
        .map((c) => ({ ...c }));
    },
    async countComments(postId) {
      return data.comments.filter((c) => c.postId === postId).length;
    },
    async getComment(id) {
      const comment = data.comments.find((c) => c.id === id);
      return comment ? { ...comment } : undefined;
    },
    async createComment(input) {
      requireUser(input.authorId);
      requirePost(input.postId);
      counters.comment += 1;
      const comment: CommentRecord = {
        id: `comment_${counters.comment}`,
        postId: input.postId,
        authorId: input.authorId,
        body: input.body,
        createdAt: now(),
      };
      data.comments.push(comment);
      return { ...comment };
    },
    async deleteComment(id) {
      const index = data.comments.findIndex((c) => c.id === id);
      if (index === -1) return false;
      data.comments.splice(index, 1);
      return true;
    },
    async listLikes(postId) {
      return data.likes.filter((l) => l.postId === postId).map((l) => ({ ...l }));
    },
    async countLikes(postId) {
      return data.likes.filter((l) => l.postId === postId).length;
    },
    async findLike(postId, userId) {
      const like = data.likes.find((l) => l.postId === postId && l.userId === userId);
      return like ? { ...like } : undefined;
    },
    async addLike(input) {
      requireUser(input.userId);
      requirePost(input.postId);
      if (data.likes.some((l) => l.postId === input.postId && l.userId === input.userId)) {
        throw new StoreError("Already liked", "CONFLICT");
      }
      counters.like += 1;
      const like: LikeRecord = {
        id: `like_${counters.like}`,
        postId: input.postId,
        userId: input.userId,
        createdAt: now(),
      };
      data.likes.push(like);
      return { ...like };
    },
    async removeLike(id) {
      const index = data.likes.findIndex((l) => l.id === id);
      if (index === -1) return false;
      data.likes.splice(index, 1);
      return true;
    },
  };
}
