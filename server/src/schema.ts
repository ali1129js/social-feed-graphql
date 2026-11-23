import { GraphQLError } from "graphql";
import { createSchema } from "graphql-yoga";
import type { ResolverContext } from "./context.js";
import { paginate } from "./paginate.js";
import { StoreError } from "./store.js";
import type { CommentRecord, LikeRecord, PostRecord } from "./types.js";
import {
  commentBodySchema,
  DEFAULT_FEED_FIRST,
  feedArgsSchema,
  idSchema,
  parseOrThrow,
  postBodySchema,
} from "./validation.js";

export const typeDefs = /* GraphQL */ `
  type Query {
    health: Health!
    feed(first: Int, after: String): FeedConnection!
    post(id: ID!): Post
    users: [User!]!
  }

  type Mutation {
    createPost(authorId: ID!, body: String!): Post!
    comment(authorId: ID!, postId: ID!, body: String!): Comment!
    like(userId: ID!, postId: ID!): Post!
    deletePost(authorId: ID!, postId: ID!): Boolean!
    deleteComment(authorId: ID!, commentId: ID!): Boolean!
  }

  type Health {
    ok: Boolean!
    service: String!
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

function requireUser(ctx: ResolverContext, id: string) {
  const user = ctx.store.getUser(id);
  if (!user) {
    throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
  }
  return user;
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
    createPost(_parent: unknown, args: { authorId: string; body: string }, ctx: ResolverContext) {
      const authorId = parseOrThrow(idSchema, args.authorId);
      const body = parseOrThrow(postBodySchema, args.body);
      requireUser(ctx, authorId);
      try {
        return ctx.store.createPost({ authorId, body });
      } catch (error) {
        graphqlFromStore(error);
      }
    },
    comment(
      _parent: unknown,
      args: { authorId: string; postId: string; body: string },
      ctx: ResolverContext,
    ) {
      const authorId = parseOrThrow(idSchema, args.authorId);
      const postId = parseOrThrow(idSchema, args.postId);
      const body = parseOrThrow(commentBodySchema, args.body);
      requireUser(ctx, authorId);
      requirePost(ctx, postId);
      try {
        return ctx.store.createComment({ authorId, postId, body });
      } catch (error) {
        graphqlFromStore(error);
      }
    },
    like(_parent: unknown, args: { userId: string; postId: string }, ctx: ResolverContext) {
      const userId = parseOrThrow(idSchema, args.userId);
      const postId = parseOrThrow(idSchema, args.postId);
      requireUser(ctx, userId);
      const post = requirePost(ctx, postId);
      const existing = ctx.store.findLike(postId, userId);
      try {
        if (existing) ctx.store.removeLike(existing.id);
        else ctx.store.addLike({ userId, postId });
        return ctx.store.getPost(post.id);
      } catch (error) {
        graphqlFromStore(error);
      }
    },
    deletePost(_parent: unknown, args: { authorId: string; postId: string }, ctx: ResolverContext) {
      const authorId = parseOrThrow(idSchema, args.authorId);
      const postId = parseOrThrow(idSchema, args.postId);
      requireUser(ctx, authorId);
      const post = requirePost(ctx, postId);
      if (post.authorId !== authorId) {
        throw new GraphQLError("You can only delete your own post", { extensions: { code: "FORBIDDEN" } });
      }
      return ctx.store.deletePost(postId);
    },
    deleteComment(_parent: unknown, args: { authorId: string; commentId: string }, ctx: ResolverContext) {
      const authorId = parseOrThrow(idSchema, args.authorId);
      const commentId = parseOrThrow(idSchema, args.commentId);
      requireUser(ctx, authorId);
      const comment = ctx.store.getComment(commentId);
      if (!comment) {
        throw new GraphQLError("Comment not found", { extensions: { code: "NOT_FOUND" } });
      }
      if (comment.authorId !== authorId) {
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
