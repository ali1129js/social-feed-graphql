import type { CommentRecord, LikeRecord, PostRecord, SeedData, UserRecord } from "./types.js";

export class StoreError extends Error {
  readonly code: "NOT_FOUND" | "CONFLICT";

  constructor(message: string, code: "NOT_FOUND" | "CONFLICT") {
    super(message);
    this.name = "StoreError";
    this.code = code;
  }
}

export interface Store {
  listUsers(): UserRecord[];
  getUser(id: string): UserRecord | undefined;
  getUserByHandle(handle: string): UserRecord | undefined;
  listPostsNewestFirst(): PostRecord[];
  getPost(id: string): PostRecord | undefined;
  createPost(input: { authorId: string; body: string }): PostRecord;
  deletePost(id: string): boolean;
  listComments(postId: string): CommentRecord[];
  getComment(id: string): CommentRecord | undefined;
  createComment(input: { authorId: string; postId: string; body: string }): CommentRecord;
  deleteComment(id: string): boolean;
  listLikes(postId: string): LikeRecord[];
  findLike(postId: string, userId: string): LikeRecord | undefined;
  addLike(input: { userId: string; postId: string }): LikeRecord;
  removeLike(id: string): boolean;
}

function copySeed(seed: SeedData): SeedData {
  return {
    users: seed.users.map((u) => ({ ...u })),
    posts: seed.posts.map((p) => ({ ...p })),
    comments: seed.comments.map((c) => ({ ...c })),
    likes: seed.likes.map((l) => ({ ...l })),
  };
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
    listUsers() {
      return data.users.map((u) => ({ ...u }));
    },
    getUser(id) {
      const user = data.users.find((u) => u.id === id);
      return user ? { ...user } : undefined;
    },
    getUserByHandle(handle) {
      const needle = handle.trim().toLowerCase();
      const user = data.users.find((u) => u.handle.toLowerCase() === needle);
      return user ? { ...user } : undefined;
    },
    listPostsNewestFirst() {
      return [...data.posts]
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
        .map((p) => ({ ...p }));
    },
    getPost(id) {
      const post = data.posts.find((p) => p.id === id);
      return post ? { ...post } : undefined;
    },
    createPost(input) {
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
    deletePost(id) {
      const index = data.posts.findIndex((p) => p.id === id);
      if (index === -1) return false;
      data.posts.splice(index, 1);
      data.comments = data.comments.filter((c) => c.postId !== id);
      data.likes = data.likes.filter((l) => l.postId !== id);
      return true;
    },
    listComments(postId) {
      return data.comments
        .filter((c) => c.postId === postId)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
        .map((c) => ({ ...c }));
    },
    getComment(id) {
      const comment = data.comments.find((c) => c.id === id);
      return comment ? { ...comment } : undefined;
    },
    createComment(input) {
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
    deleteComment(id) {
      const index = data.comments.findIndex((c) => c.id === id);
      if (index === -1) return false;
      data.comments.splice(index, 1);
      return true;
    },
    listLikes(postId) {
      return data.likes.filter((l) => l.postId === postId).map((l) => ({ ...l }));
    },
    findLike(postId, userId) {
      const like = data.likes.find((l) => l.postId === postId && l.userId === userId);
      return like ? { ...like } : undefined;
    },
    addLike(input) {
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
    removeLike(id) {
      const index = data.likes.findIndex((l) => l.id === id);
      if (index === -1) return false;
      data.likes.splice(index, 1);
      return true;
    },
  };
}
