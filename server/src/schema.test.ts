import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { seedData } from "./seed.js";
import { createMemoryStore } from "./store.js";
import { MAX_COMMENT_BODY, MAX_POST_BODY } from "./validation.js";

interface GraphQLBody {
  data?: Record<string, unknown> | null;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
}

const FEED_FIELDS = `{
  totalCount
  pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
  edges {
    cursor
    node {
      id
      body
      createdAt
      likeCount
      commentCount
      author { id handle displayName }
      comments { id body author { handle } }
      likes { id user { handle } }
    }
  }
}`;

async function request(
  query: string,
  variables?: Record<string, unknown>,
  app = createApp(),
): Promise<{ status: number; body: GraphQLBody }> {
  const res = await app.fetch("http://localhost/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(variables ? { query, variables } : { query }),
  });
  return { status: res.status, body: (await res.json()) as GraphQLBody };
}

function errorMessage(body: GraphQLBody): string {
  return body.errors?.[0]?.message ?? "";
}

describe("GraphQL server", () => {
  it("answers the health query", async () => {
    const { status, body } = await request("{ health { ok service } }");
    expect(status).toBe(200);
    expect(body.data).toEqual({ health: { ok: true, service: "social-feed-server" } });
  });

  it("rejects unknown fields with a GraphQL error", async () => {
    const { body } = await request("{ nope }");
    expect(Array.isArray(body.errors)).toBe(true);
  });
});

describe("feed query", () => {
  it("returns seeded posts newest first with authors, comments and likes", async () => {
    const { body } = await request(`query { feed ${FEED_FIELDS} }`);
    const feed = body.data?.["feed"] as {
      totalCount: number;
      pageInfo: { hasNextPage: boolean; startCursor: string; endCursor: string };
      edges: Array<{
        cursor: string;
        node: {
          id: string;
          body: string;
          author: { handle: string };
          likeCount: number;
          commentCount: number;
        };
      }>;
    };
    expect(body.errors).toBeUndefined();
    expect(feed.totalCount).toBe(8);
    expect(feed.edges).toHaveLength(8);
    expect(feed.edges.map((e) => e.node.id)).toEqual([
      "post_8",
      "post_7",
      "post_6",
      "post_5",
      "post_4",
      "post_3",
      "post_2",
      "post_1",
    ]);
    expect(feed.edges[0]?.node.author.handle).toBe("priya");
    expect(feed.edges[0]?.node.likeCount).toBe(2);
    expect(feed.edges[0]?.node.commentCount).toBe(1);
    expect(feed.pageInfo.hasNextPage).toBe(false);
    expect(feed.edges[0]?.cursor).toBe("post_8");
  });

  it("paginates with first and after", async () => {
    const firstPage = await request("query ($first: Int) { feed(first: $first) { edges { cursor node { id } } pageInfo { hasNextPage endCursor } totalCount } }", {
      first: 3,
    });
    const page = firstPage.body.data?.["feed"] as {
      totalCount: number;
      pageInfo: { hasNextPage: boolean; endCursor: string };
      edges: Array<{ cursor: string; node: { id: string } }>;
    };
    expect(page.totalCount).toBe(8);
    expect(page.edges.map((e) => e.node.id)).toEqual(["post_8", "post_7", "post_6"]);
    expect(page.pageInfo.hasNextPage).toBe(true);

    const secondPage = await request(
      "query ($first: Int, $after: String) { feed(first: $first, after: $after) { edges { node { id } } pageInfo { hasNextPage hasPreviousPage } } }",
      { first: 3, after: page.pageInfo.endCursor },
    );
    const next = secondPage.body.data?.["feed"] as {
      pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean };
      edges: Array<{ node: { id: string } }>;
    };
    expect(next.edges.map((e) => e.node.id)).toEqual(["post_5", "post_4", "post_3"]);
    expect(next.pageInfo.hasNextPage).toBe(true);
    expect(next.pageInfo.hasPreviousPage).toBe(true);
  });

  it("rejects an invalid cursor and an out-of-range first", async () => {
    const badCursor = await request('query { feed(after: "missing") { edges { cursor } } }');
    expect(errorMessage(badCursor.body)).toMatch(/invalid cursor/i);

    const badFirst = await request("query { feed(first: 0) { edges { cursor } } }");
    expect(errorMessage(badFirst.body)).toMatch(/first must be at least 1/i);
  });

  it("returns a single post or null", async () => {
    const found = await request('query { post(id: "post_2") { id author { handle } body } }');
    expect(found.body.data).toEqual({
      post: {
        id: "post_2",
        author: { handle: "noah" },
        body: "Refactored a messy module by writing the tests first. Slower to start, much faster to finish.",
      },
    });
    const missing = await request('query { post(id: "post_999") { id } }');
    expect(missing.body.data).toEqual({ post: null });
  });

  it("lists seeded users", async () => {
    const { body } = await request("{ users { id handle displayName } }");
    const users = body.data?.["users"] as Array<{ handle: string }>;
    expect(users.map((u) => u.handle)).toEqual(["maya", "noah", "luca", "priya", "elena"]);
  });
});

describe("mutations", () => {
  it("creates a post and puts it at the top of the feed", async () => {
    const app = createApp();
    const { body } = await request(
      'mutation { createPost(authorId: "user_3", body: "A new walk by the river.") { id body author { handle } likeCount commentCount } }',
      undefined,
      app,
    );
    const post = body.data?.["createPost"] as { id: string; body: string; author: { handle: string } };
    expect(body.errors).toBeUndefined();
    expect(post.body).toBe("A new walk by the river.");
    expect(post.author.handle).toBe("luca");

    const feed = await request("query { feed(first: 1) { edges { node { id body } } totalCount } }", undefined, app);
    const data = feed.body.data?.["feed"] as { totalCount: number; edges: Array<{ node: { id: string; body: string } }> };
    expect(data.totalCount).toBe(9);
    expect(data.edges[0]?.node.id).toBe(post.id);
    expect(data.edges[0]?.node.body).toBe("A new walk by the river.");
  });

  it("rejects an empty or too-long post body", async () => {
    const empty = await request('mutation { createPost(authorId: "user_1", body: "   ") { id } }');
    expect(errorMessage(empty.body)).toMatch(/cannot be empty/i);

    const tooLong = await request(
      "mutation ($body: String!) { createPost(authorId: \"user_1\", body: $body) { id } }",
      { body: "x".repeat(MAX_POST_BODY + 1) },
    );
    expect(errorMessage(tooLong.body)).toMatch(/at most 500/i);
  });

  it("adds a comment to a post", async () => {
    const app = createApp();
    const { body } = await request(
      'mutation { comment(authorId: "user_4", postId: "post_7", body: "Those speakers were a good buy.") { id body author { handle } postId } }',
      undefined,
      app,
    );
    expect(body.errors).toBeUndefined();
    expect(body.data?.["comment"]).toMatchObject({
      body: "Those speakers were a good buy.",
      author: { handle: "priya" },
      postId: "post_7",
    });
    const post = await request('query { post(id: "post_7") { commentCount comments { body author { handle } } } }', undefined, app);
    const data = post.body.data?.["post"] as { commentCount: number; comments: Array<{ body: string }> };
    expect(data.commentCount).toBe(1);
    expect(data.comments.at(-1)?.body).toBe("Those speakers were a good buy.");
  });

  it("rejects an empty comment and a missing post", async () => {
    const empty = await request('mutation { comment(authorId: "user_1", postId: "post_1", body: "") { id } }');
    expect(errorMessage(empty.body)).toMatch(/cannot be empty/i);

    const missing = await request(
      'mutation { comment(authorId: "user_1", postId: "post_999", body: "Hello") { id } }',
    );
    expect(errorMessage(missing.body)).toMatch(/post not found/i);

    const tooLong = await request(
      "mutation ($body: String!) { comment(authorId: \"user_1\", postId: \"post_1\", body: $body) { id } }",
      { body: "y".repeat(MAX_COMMENT_BODY + 1) },
    );
    expect(errorMessage(tooLong.body)).toMatch(/at most 280/i);
  });

  it("toggles a like and updates likeCount", async () => {
    const app = createApp();
    const liked = await request(
      'mutation { like(userId: "user_5", postId: "post_7") { id likeCount likes { user { handle } } } }',
      undefined,
      app,
    );
    const afterLike = liked.body.data?.["like"] as { likeCount: number; likes: Array<{ user: { handle: string } }> };
    expect(afterLike.likeCount).toBe(1);
    expect(afterLike.likes.map((l) => l.user.handle)).toContain("elena");

    const unliked = await request(
      'mutation { like(userId: "user_5", postId: "post_7") { likeCount likes { user { handle } } } }',
      undefined,
      app,
    );
    const afterUnlike = unliked.body.data?.["like"] as { likeCount: number; likes: Array<{ user: { handle: string } }> };
    expect(afterUnlike.likeCount).toBe(0);
    expect(afterUnlike.likes).toEqual([]);
  });

  it("lets an author delete their own post and refuses anyone else", async () => {
    const app = createApp();
    const forbidden = await request('mutation { deletePost(authorId: "user_2", postId: "post_8") }', undefined, app);
    expect(errorMessage(forbidden.body)).toMatch(/your own post/i);

    const allowed = await request('mutation { deletePost(authorId: "user_4", postId: "post_8") }', undefined, app);
    expect(allowed.body.data).toEqual({ deletePost: true });
    const missing = await request('query { post(id: "post_8") { id } }', undefined, app);
    expect(missing.body.data).toEqual({ post: null });
    const commentsGone = await request("query { feed { totalCount edges { node { id } } } }", undefined, app);
    const feed = commentsGone.body.data?.["feed"] as { totalCount: number; edges: Array<{ node: { id: string } }> };
    expect(feed.totalCount).toBe(7);
    expect(feed.edges.map((e) => e.node.id)).not.toContain("post_8");
  });

  it("lets an author delete their own comment and refuses anyone else", async () => {
    const app = createApp();
    const forbidden = await request(
      'mutation { deleteComment(authorId: "user_1", commentId: "comment_5") }',
      undefined,
      app,
    );
    expect(errorMessage(forbidden.body)).toMatch(/your own comment/i);

    const allowed = await request(
      'mutation { deleteComment(authorId: "user_5", commentId: "comment_5") }',
      undefined,
      app,
    );
    expect(allowed.body.data).toEqual({ deleteComment: true });
    const post = await request('query { post(id: "post_8") { commentCount comments { id } } }', undefined, app);
    const data = post.body.data?.["post"] as { commentCount: number; comments: Array<{ id: string }> };
    expect(data.commentCount).toBe(0);
    expect(data.comments).toEqual([]);
  });

  it("uses the injected store so tests stay isolated", async () => {
    const store = createMemoryStore(seedData(), () => "2026-11-24T08:00:00.000Z");
    store.deletePost("post_1");
    const app = createApp({ store });
    const { body } = await request("query { feed { totalCount } }", undefined, app);
    expect(body.data).toEqual({ feed: { totalCount: 7 } });
  });
});
