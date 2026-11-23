import { GraphQLError } from "graphql";
import { createSchema } from "graphql-yoga";
import { signToken } from "./auth.js";
import type { ResolverContext } from "./context.js";
import { paginate } from "./paginate.js";
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
  throw error;
}

function requireAuth(ctx: ResolverContext): UserRecord {
  if (!ctx.user) {
    throw new GraphQLError("Sign in required", { extensions: { code: "UNAUTHENTICATED" } });
  }
  return ctx.user;
}

function requirePost(ctx: ResolverContext, id: string) {
  const post = ctx.store.getPost(id);
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
    feed(_parent: unknown, args: { first?: number | null; after?: string | null }, ctx: ResolverContext) {
      const parsed = parseOrThrow(feedArgsSchema, {
        first: args.first ?? undefined,
        after: args.after ?? undefined,
      });
      return paginate(ctx.store.listPostsNewestFirst(), parsed.first ?? DEFAULT_FEED_FIRST, parsed.after ?? undefined);
    },
    post(_parent: unknown, args: { id: string }, ctx: ResolverContext) {
      const id = parseOrThrow(idSchema, args.id);
      return ctx.store.getPost(id) ?? null;
    },
    users(_parent: unknown, _args: unknown, ctx: ResolverContext) {
      return ctx.store.listUsers();
    },
  },
  Mutation: {
    async signIn(_parent: unknown, args: { handle: string }, ctx: ResolverContext) {
      const handle = parseOrThrow(handleSchema, args.handle);
      const user = ctx.store.getUserByHandle(handle);
      if (!user) {
        throw new GraphQLError("Unknown user", { extensions: { code: "UNAUTHENTICATED" } });
      }
      const token = await signToken(user, ctx.jwtSecret);
      return { token, user };
    },
    createPost(_parent: unknown, args: { body: string }, ctx: ResolverContext) {
      const user = requireAuth(ctx);
      const body = parseOrThrow(postBodySchema, args.body);
      try {
        return ctx.store.createPost({ authorId: user.id, body });
      } catch (error) {
        graphqlFromStore(error);
      }
    },
    comment(_parent: unknown, args: { postId: string; body: string }, ctx: ResolverContext) {
      const user = requireAuth(ctx);
      const postId = parseOrThrow(idSchema, args.postId);
      const body = parseOrThrow(commentBodySchema, args.body);
      requirePost(ctx, postId);
      try {
        return ctx.store.createComment({ authorId: user.id, postId, body });
      } catch (error) {
        graphqlFromStore(error);
      }
    },
    like(_parent: unknown, args: { postId: string }, ctx: ResolverContext) {
      const user = requireAuth(ctx);
      const postId = parseOrThrow(idSchema, args.postId);
      const post = requirePost(ctx, postId);
      const existing = ctx.store.findLike(postId, user.id);
      try {
        if (existing) ctx.store.removeLike(existing.id);
        else ctx.store.addLike({ userId: user.id, postId });
        const updated = ctx.store.getPost(post.id);
        if (!updated) throw new GraphQLError("Post not found", { extensions: { code: "NOT_FOUND" } });
        return updated;
      } catch (error) {
        graphqlFromStore(error);
      }
    },
    deletePost(_parent: unknown, args: { postId: string }, ctx: ResolverContext) {
      const user = requireAuth(ctx);
      const postId = parseOrThrow(idSchema, args.postId);
      const post = requirePost(ctx, postId);
      if (post.authorId !== user.id) {
        throw new GraphQLError("You can only delete your own post", { extensions: { code: "FORBIDDEN" } });
      }
      return ctx.store.deletePost(postId);
    },
    deleteComment(_parent: unknown, args: { commentId: string }, ctx: ResolverContext) {
      const user = requireAuth(ctx);
      const commentId = parseOrThrow(idSchema, args.commentId);
      const comment = ctx.store.getComment(commentId);
      if (!comment) {
        throw new GraphQLError("Comment not found", { extensions: { code: "NOT_FOUND" } });
      }
      if (comment.authorId !== user.id) {
        throw new GraphQLError("You can only delete your own comment", { extensions: { code: "FORBIDDEN" } });
      }
      return ctx.store.deleteComment(commentId);
    },
  },
  Post: {
    author(post: PostRecord, _args: unknown, ctx: ResolverContext) {
      const user = ctx.store.getUser(post.authorId);
      if (!user) throw new GraphQLError("Author missing", { extensions: { code: "NOT_FOUND" } });
      return user;
    },
    comments(post: PostRecord, _args: unknown, ctx: ResolverContext) {
      return ctx.store.listComments(post.id);
    },
    likes(post: PostRecord, _args: unknown, ctx: ResolverContext) {
      return ctx.store.listLikes(post.id);
    },
    likeCount(post: PostRecord, _args: unknown, ctx: ResolverContext) {
      return ctx.store.listLikes(post.id).length;
    },
    commentCount(post: PostRecord, _args: unknown, ctx: ResolverContext) {
      return ctx.store.listComments(post.id).length;
    },
    likedByMe(post: PostRecord, _args: unknown, ctx: ResolverContext) {
      if (!ctx.user) return false;
      return ctx.store.findLike(post.id, ctx.user.id) !== undefined;
    },
  },
  Comment: {
    author(comment: CommentRecord, _args: unknown, ctx: ResolverContext) {
      const user = ctx.store.getUser(comment.authorId);
      if (!user) throw new GraphQLError("Author missing", { extensions: { code: "NOT_FOUND" } });
      return user;
    },
  },
  Like: {
    user(like: LikeRecord, _args: unknown, ctx: ResolverContext) {
      const user = ctx.store.getUser(like.userId);
      if (!user) throw new GraphQLError("User missing", { extensions: { code: "NOT_FOUND" } });
      return user;
    },
  },
};

export const schema = createSchema({ typeDefs, resolvers });
