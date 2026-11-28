import { GraphQLError } from "graphql";
import { createSchema } from "graphql-yoga";
import { signToken } from "./auth.js";
import type { ResolverContext } from "./context.js";
import { toConnection } from "./paginate.js";
import { StoreError } from "./store.js";
import type { CommentRecord, LikeRecord, PostRecord, UserRecord } from "./types.js";
import {
  commentBodySchema,
  DEFAULT_FEED_FIRST,
  feedArgsSchema,
  handleSchema,
  idSchema,
  parseOrThrow,
  postBodySchema,
} from "./validation.js";

export const typeDefs = /* GraphQL */ `
  type Query {
    health: Health!
    me: User
    feed(first: Int, after: String): FeedConnection!
    post(id: ID!): Post
    users: [User!]!
  }

  type Mutation {
    signIn(handle: String!): AuthPayload!
    createPost(body: String!): Post!
    comment(postId: ID!, body: String!): Comment!
    like(postId: ID!): Post!
    deletePost(postId: ID!): Boolean!
    deleteComment(commentId: ID!): Boolean!
  }

  type Health {
    ok: Boolean!
    service: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type User {
    id: ID!
    handle: String!
    displayName: String!
  }

  type Post {
    id: ID!
    body: String!
    createdAt: String!
    author: User!
    comments: [Comment!]!
    likes: [Like!]!
    likeCount: Int!
    commentCount: Int!
    likedByMe: Boolean!
  }

  type Comment {
    id: ID!
    body: String!
    createdAt: String!
    author: User!
    postId: ID!
  }

  type Like {
    id: ID!
    createdAt: String!
    user: User!
    postId: ID!
  }

  type FeedEdge {
    cursor: String!
    node: Post!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type FeedConnection {
    edges: [FeedEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }
`;

function graphqlFromStore(error: unknown): never {
  if (error instanceof StoreError && error.code === "NOT_FOUND") {
    throw new GraphQLError(error.message, { extensions: { code: "NOT_FOUND" } });
  }
  if (error instanceof StoreError && error.code === "CONFLICT") {
    throw new GraphQLError(error.message, { extensions: { code: "CONFLICT" } });
  }
  if (error instanceof StoreError && error.code === "BAD_CURSOR") {
    throw new GraphQLError("Invalid cursor", { extensions: { code: "BAD_USER_INPUT" } });
  }
  throw error;
}

function requireAuth(ctx: ResolverContext): UserRecord {
  if (!ctx.user) {
    throw new GraphQLError("Sign in required", { extensions: { code: "UNAUTHENTICATED" } });
  }
  return ctx.user;
}

async function requirePost(ctx: ResolverContext, id: string) {
  const post = await ctx.store.getPost(id);
  if (!post) {
    throw new GraphQLError("Post not found", { extensions: { code: "NOT_FOUND" } });
  }
  return post;
}

export const resolvers = {
  Query: {
    health: () => ({ ok: true, service: "social-feed-server" }),
    me(_parent: unknown, _args: unknown, ctx: ResolverContext) {
      return ctx.user ?? null;
    },
    async feed(_parent: unknown, args: { first?: number | null; after?: string | null }, ctx: ResolverContext) {
      const parsed = parseOrThrow(feedArgsSchema, {
        first: args.first ?? undefined,
        after: args.after ?? undefined,
      });
      try {
        const page = await ctx.store.listFeedPage(parsed.first ?? DEFAULT_FEED_FIRST, parsed.after ?? undefined);
        return toConnection(page);
      } catch (error) {
        graphqlFromStore(error);
      }
    },
    async post(_parent: unknown, args: { id: string }, ctx: ResolverContext) {
      const id = parseOrThrow(idSchema, args.id);
      return (await ctx.store.getPost(id)) ?? null;
    },
    async users(_parent: unknown, _args: unknown, ctx: ResolverContext) {
      return await ctx.store.listUsers();
    },
  },
  Mutation: {
    async signIn(_parent: unknown, args: { handle: string }, ctx: ResolverContext) {
      const handle = parseOrThrow(handleSchema, args.handle);
      const user = await ctx.store.getUserByHandle(handle);
      if (!user) {
        throw new GraphQLError("Unknown user", { extensions: { code: "UNAUTHENTICATED" } });
      }
      const token = await signToken(user, ctx.jwtSecret);
      return { token, user };
    },
    async createPost(_parent: unknown, args: { body: string }, ctx: ResolverContext) {
      const user = requireAuth(ctx);
      const body = parseOrThrow(postBodySchema, args.body);
      try {
        return await ctx.store.createPost({ authorId: user.id, body });
      } catch (error) {
        graphqlFromStore(error);
      }
    },
    async comment(_parent: unknown, args: { postId: string; body: string }, ctx: ResolverContext) {
      const user = requireAuth(ctx);
      const postId = parseOrThrow(idSchema, args.postId);
      const body = parseOrThrow(commentBodySchema, args.body);
      await requirePost(ctx, postId);
      try {
        return await ctx.store.createComment({ authorId: user.id, postId, body });
      } catch (error) {
        graphqlFromStore(error);
      }
    },
    async like(_parent: unknown, args: { postId: string }, ctx: ResolverContext) {
      const user = requireAuth(ctx);
      const postId = parseOrThrow(idSchema, args.postId);
      const post = await requirePost(ctx, postId);
      const existing = await ctx.store.findLike(postId, user.id);
      try {
        if (existing) await ctx.store.removeLike(existing.id);
        else await ctx.store.addLike({ userId: user.id, postId });
        const updated = await ctx.store.getPost(post.id);
        if (!updated) throw new GraphQLError("Post not found", { extensions: { code: "NOT_FOUND" } });
        return updated;
      } catch (error) {
        graphqlFromStore(error);
      }
    },
    async deletePost(_parent: unknown, args: { postId: string }, ctx: ResolverContext) {
      const user = requireAuth(ctx);
      const postId = parseOrThrow(idSchema, args.postId);
      const post = await requirePost(ctx, postId);
      if (post.authorId !== user.id) {
        throw new GraphQLError("You can only delete your own post", { extensions: { code: "FORBIDDEN" } });
      }
      return await ctx.store.deletePost(postId);
    },
    async deleteComment(_parent: unknown, args: { commentId: string }, ctx: ResolverContext) {
      const user = requireAuth(ctx);
      const commentId = parseOrThrow(idSchema, args.commentId);
      const comment = await ctx.store.getComment(commentId);
      if (!comment) {
        throw new GraphQLError("Comment not found", { extensions: { code: "NOT_FOUND" } });
      }
      if (comment.authorId !== user.id) {
        throw new GraphQLError("You can only delete your own comment", { extensions: { code: "FORBIDDEN" } });
      }
      return await ctx.store.deleteComment(commentId);
    },
  },
  Post: {
    async author(post: PostRecord, _args: unknown, ctx: ResolverContext) {
      const user = await ctx.store.getUser(post.authorId);
      if (!user) throw new GraphQLError("Author missing", { extensions: { code: "NOT_FOUND" } });
      return user;
    },
    async comments(post: PostRecord, _args: unknown, ctx: ResolverContext) {
      return await ctx.store.listComments(post.id);
    },
    async likes(post: PostRecord, _args: unknown, ctx: ResolverContext) {
      return await ctx.store.listLikes(post.id);
    },
    async likeCount(post: PostRecord, _args: unknown, ctx: ResolverContext) {
      return await ctx.store.countLikes(post.id);
    },
    async commentCount(post: PostRecord, _args: unknown, ctx: ResolverContext) {
      return await ctx.store.countComments(post.id);
    },
    async likedByMe(post: PostRecord, _args: unknown, ctx: ResolverContext) {
      if (!ctx.user) return false;
      return (await ctx.store.findLike(post.id, ctx.user.id)) !== undefined;
    },
  },
  Comment: {
    async author(comment: CommentRecord, _args: unknown, ctx: ResolverContext) {
      const user = await ctx.store.getUser(comment.authorId);
      if (!user) throw new GraphQLError("Author missing", { extensions: { code: "NOT_FOUND" } });
      return user;
    },
  },
  Like: {
    async user(like: LikeRecord, _args: unknown, ctx: ResolverContext) {
      const user = await ctx.store.getUser(like.userId);
      if (!user) throw new GraphQLError("User missing", { extensions: { code: "NOT_FOUND" } });
      return user;
    },
  },
};

export const schema = createSchema({ typeDefs, resolvers });
