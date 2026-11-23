import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { seedData } from "./seed.js";
import { createMemoryStore } from "./store.js";
import { MAX_COMMENT_BODY, MAX_POST_BODY } from "./validation.js";

interface GraphQLBody {
  data?: Record<string, unknown> | null;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
}

type App = ReturnType<typeof createApp>;

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
      likedByMe
      author { id handle displayName }
      comments { id body author { handle } }
      likes { id user { handle } }
    }
  }
}`;

async function request(
  query: string,
  options: { variables?: Record<string, unknown>; token?: string; app?: App } = {},
): Promise<{ status: number; body: GraphQLBody }> {
  const app = options.app ?? createApp();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.token) headers.authorization = "Bearer " + options.token;
  const res = await app.fetch("http://localhost/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify(options.variables ? { query, variables: options.variables } : { query }),
  });
  return { status: res.status, body: (await res.json()) as GraphQLBody };
}

async function signIn(app: App, handle: string): Promise<string> {
  const { body } = await request(`mutation { signIn(handle: "${handle}") { token user { id handle } } }`, { app });
  const payload = body.data?.["signIn"] as { token: string } | undefined;
  if (!payload?.token) throw new Error("sign-in failed: " + (body.errors?.[0]?.message ?? "no token"));
  return payload.token;
}

function errorMessage(body: GraphQLBody): string {
  return body.errors?.[0]?.message ?? "";
}

function errorCode(body: GraphQLBody): string | undefined {
  return body.errors?.[0]?.extensions?.code;
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
          likedByMe: boolean;
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
    expect(feed.edges[0]?.node.likedByMe).toBe(false);
    expect(feed.pageInfo.hasNextPage).toBe(false);
    expect(feed.edges[0]?.cursor).toBe("post_8");
  });

  it("paginates with first and after", async () => {
    const firstPage = await request(
      "query ($first: Int) { feed(first: $first) { edges { cursor node { id } } pageInfo { hasNextPage endCursor } totalCount } }",
      { variables: { first: 3 } },
    );
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
      { variables: { first: 3, after: page.pageInfo.endCursor } },
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

describe("auth", () => {
  it("signs in a seeded user by handle, with no password", async () => {
    const { body } = await request('mutation { signIn(handle: "Maya") { token user { id handle displayName } } }');
    const payload = body.data?.["signIn"] as { token: string; user: { id: string; handle: string; displayName: string } };
    expect(body.errors).toBeUndefined();
    expect(payload.user).toEqual({ id: "user_1", handle: "maya", displayName: "Maya Chen" });
    expect(payload.token.split(".")).toHaveLength(3);
  });

  it("rejects an unknown or empty handle", async () => {
    const unknown = await request('mutation { signIn(handle: "nobody") { token } }');
    expect(errorMessage(unknown.body)).toMatch(/unknown user/i);
    expect(errorCode(unknown.body)).toBe("UNAUTHENTICATED");

    const empty = await request('mutation { signIn(handle: "  ") { token } }');
    expect(errorMessage(empty.body)).toMatch(/handle is required/i);
  });

  it("returns me when the request carries a signed token", async () => {
    const app = createApp();
    expect((await request("query { me { handle } }", { app })).body.data).toEqual({ me: null });

    const token = await signIn(app, "noah");
    const { body } = await request("query { me { id handle displayName } }", { app, token });
    expect(body.data).toEqual({ me: { id: "user_2", handle: "noah", displayName: "Noah Patel" } });
  });

  it("ignores a forged or mismatched token", async () => {
    const app = createApp({ jwtSecret: "test-secret-a" });
    const other = createApp({ jwtSecret: "test-secret-b" });
    const token = await signIn(other, "maya");
    const { body } = await request("query { me { handle } }", { app, token });
    expect(body.data).toEqual({ me: null });

    const invalid = await request("query { me { handle } }", { app, token: "not-a-token" });
    expect(invalid.body.data).toEqual({ me: null });
  });

  it("marks likedByMe from the signed-in user", async () => {
    const app = createApp();
    const token = await signIn(app, "maya");
    const { body } = await request('query { post(id: "post_8") { likedByMe likeCount } }', { app, token });
    // maya (user_1) already likes post_8
    expect(body.data).toEqual({ post: { likedByMe: true, likeCount: 2 } });
  });
});

describe("mutations", () => {
  it("creates a post as the signed-in user and puts it at the top of the feed", async () => {
    const app = createApp();
    const token = await signIn(app, "luca");
    const { body } = await request(
      'mutation { createPost(body: "A new walk by the river.") { id body author { handle } likeCount commentCount } }',
      { app, token },
    );
    const post = body.data?.["createPost"] as { id: string; body: string; author: { handle: string } };
    expect(body.errors).toBeUndefined();
    expect(post.body).toBe("A new walk by the river.");
    expect(post.author.handle).toBe("luca");

    const feed = await request("query { feed(first: 1) { edges { node { id body } } totalCount } }", { app });
    const data = feed.body.data?.["feed"] as { totalCount: number; edges: Array<{ node: { id: string; body: string } }> };
    expect(data.totalCount).toBe(9);
    expect(data.edges[0]?.node.id).toBe(post.id);
    expect(data.edges[0]?.node.body).toBe("A new walk by the river.");
  });

  it("rejects an unauthenticated mutation and an empty or too-long post body", async () => {
    const app = createApp();
    const unauth = await request('mutation { createPost(body: "Hello from nobody.") { id } }', { app });
    expect(errorMessage(unauth.body)).toMatch(/sign in required/i);
    expect(errorCode(unauth.body)).toBe("UNAUTHENTICATED");

    const token = await signIn(app, "maya");
    const empty = await request('mutation { createPost(body: "   ") { id } }', { app, token });
    expect(errorMessage(empty.body)).toMatch(/cannot be empty/i);

    const tooLong = await request("mutation ($body: String!) { createPost(body: $body) { id } }", {
      app,
      token,
      variables: { body: "x".repeat(MAX_POST_BODY + 1) },
    });
    expect(errorMessage(tooLong.body)).toMatch(/at most 500/i);
  });

  it("adds a comment to a post", async () => {
    const app = createApp();
    const token = await signIn(app, "priya");
    const { body } = await request(
      'mutation { comment(postId: "post_7", body: "Those speakers were a good buy.") { id body author { handle } postId } }',
      { app, token },
    );
    expect(body.errors).toBeUndefined();
    expect(body.data?.["comment"]).toMatchObject({
      body: "Those speakers were a good buy.",
      author: { handle: "priya" },
      postId: "post_7",
    });
    const post = await request('query { post(id: "post_7") { commentCount comments { body author { handle } } } }', {
      app,
    });
    const data = post.body.data?.["post"] as { commentCount: number; comments: Array<{ body: string }> };
    expect(data.commentCount).toBe(1);
    expect(data.comments.at(-1)?.body).toBe("Those speakers were a good buy.");
  });

  it("rejects an empty comment and a missing post", async () => {
    const app = createApp();
    const token = await signIn(app, "maya");
    const empty = await request('mutation { comment(postId: "post_1", body: "") { id } }', { app, token });
    expect(errorMessage(empty.body)).toMatch(/cannot be empty/i);

    const missing = await request('mutation { comment(postId: "post_999", body: "Hello") { id } }', { app, token });
    expect(errorMessage(missing.body)).toMatch(/post not found/i);

    const tooLong = await request('mutation ($body: String!) { comment(postId: "post_1", body: $body) { id } }', {
      app,
      token,
      variables: { body: "y".repeat(MAX_COMMENT_BODY + 1) },
    });
    expect(errorMessage(tooLong.body)).toMatch(/at most 280/i);
  });

  it("toggles a like and updates likeCount and likedByMe", async () => {
    const app = createApp();
    const token = await signIn(app, "elena");
    const liked = await request(
      'mutation { like(postId: "post_7") { id likeCount likedByMe likes { user { handle } } } }',
      { app, token },
    );
    const afterLike = liked.body.data?.["like"] as {
      likeCount: number;
      likedByMe: boolean;
      likes: Array<{ user: { handle: string } }>;
    };
    expect(afterLike.likeCount).toBe(1);
    expect(afterLike.likedByMe).toBe(true);
    expect(afterLike.likes.map((l) => l.user.handle)).toContain("elena");

    const unliked = await request('mutation { like(postId: "post_7") { likeCount likedByMe likes { user { handle } } } }', {
      app,
      token,
    });
    const afterUnlike = unliked.body.data?.["like"] as {
      likeCount: number;
      likedByMe: boolean;
      likes: Array<{ user: { handle: string } }>;
    };
    expect(afterUnlike.likeCount).toBe(0);
    expect(afterUnlike.likedByMe).toBe(false);
    expect(afterUnlike.likes).toEqual([]);
  });

  it("lets an author delete their own post and refuses anyone else", async () => {
    const app = createApp();
    const noah = await signIn(app, "noah");
    const forbidden = await request('mutation { deletePost(postId: "post_8") }', { app, token: noah });
    expect(errorMessage(forbidden.body)).toMatch(/your own post/i);
    expect(errorCode(forbidden.body)).toBe("FORBIDDEN");

    const priya = await signIn(app, "priya");
    const allowed = await request('mutation { deletePost(postId: "post_8") }', { app, token: priya });
    expect(allowed.body.data).toEqual({ deletePost: true });
    const missing = await request('query { post(id: "post_8") { id } }', { app });
    expect(missing.body.data).toEqual({ post: null });
    const commentsGone = await request("query { feed { totalCount edges { node { id } } } }", { app });
    const feed = commentsGone.body.data?.["feed"] as { totalCount: number; edges: Array<{ node: { id: string } }> };
    expect(feed.totalCount).toBe(7);
    expect(feed.edges.map((e) => e.node.id)).not.toContain("post_8");
  });

  it("lets an author delete their own comment and refuses anyone else", async () => {
    const app = createApp();
    const maya = await signIn(app, "maya");
    const forbidden = await request('mutation { deleteComment(commentId: "comment_5") }', { app, token: maya });
    expect(errorMessage(forbidden.body)).toMatch(/your own comment/i);
    expect(errorCode(forbidden.body)).toBe("FORBIDDEN");

    const elena = await signIn(app, "elena");
    const allowed = await request('mutation { deleteComment(commentId: "comment_5") }', { app, token: elena });
    expect(allowed.body.data).toEqual({ deleteComment: true });
    const post = await request('query { post(id: "post_8") { commentCount comments { id } } }', { app });
    const data = post.body.data?.["post"] as { commentCount: number; comments: Array<{ id: string }> };
    expect(data.commentCount).toBe(0);
    expect(data.comments).toEqual([]);
  });

  it("uses the injected store so tests stay isolated", async () => {
    const store = createMemoryStore(seedData(), () => "2026-11-24T08:00:00.000Z");
    store.deletePost("post_1");
    const app = createApp({ store });
    const { body } = await request("query { feed { totalCount } }", { app });
    expect(body.data).toEqual({ feed: { totalCount: 7 } });
  });
});
