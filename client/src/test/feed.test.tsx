import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../App";
import type { GqlPost } from "../graphql/types";
import {
  feedData,
  installGraphqlFetch,
  jsonResponse,
  makePost,
  maya,
  operationName,
  priya,
} from "./graphql";

const morningPost = makePost({
  id: "post_8",
  body: "A grey morning, a long walk, and a warm bakery at the end of it.",
  author: priya,
  likeCount: 2,
  commentCount: 1,
  comments: [
    {
      id: "comment_5",
      postId: "post_8",
      body: "That sounds like the right kind of morning.",
      createdAt: "2026-11-23T09:28:00.000Z",
      author: maya,
    },
  ],
});

function defaultHandler(posts: GqlPost[]) {
  return (req: { query: string; variables?: Record<string, unknown> }, headers: Headers) => {
    const name = operationName(req.query);
    if (name === "Feed") return feedData(posts);
    if (name === "Users") return { users: [maya, priya] };
    if (name === "Me") {
      const auth = headers.get("authorization");
      return { me: auth ? maya : null };
    }
    throw new Error("unexpected operation " + name);
  };
}

describe("client feed", () => {
  it("shows a loading state then the empty state", async () => {
    let resolveFeed: ((value: unknown) => void) | undefined;
    const pending = new Promise((resolve) => {
      resolveFeed = resolve;
    });
    installGraphqlFetch(async (req) => {
      const name = operationName(req.query);
      if (name === "Feed") return pending;
      if (name === "Users") return { users: [maya] };
      if (name === "Me") return { me: null };
      return {};
    });
    render(<App />);
    expect(await screen.findByText("Loading the feed…")).toBeInTheDocument();
    expect(screen.getByText(/first load can take 30 to 60 seconds/)).toBeInTheDocument();
    resolveFeed?.(feedData([]));
    expect(await screen.findByText("No posts yet.")).toBeInTheDocument();
  });

  it("shows an error state and retries", async () => {
    let fail = true;
    installGraphqlFetch(async (req) => {
      const name = operationName(req.query);
      if (name === "Feed") {
        if (fail) return jsonResponse(null, [{ message: "server down" }]);
        return feedData([]);
      }
      if (name === "Users") return { users: [maya] };
      if (name === "Me") return { me: null };
      return {};
    });
    render(<App />);
    expect(await screen.findByText("The feed could not be loaded.")).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No posts yet.")).toBeInTheDocument();
  });

  it("renders posts, likes and comments", async () => {
    installGraphqlFetch(defaultHandler([morningPost]));
    render(<App />);
    expect(await screen.findByText(/grey morning/)).toBeInTheDocument();
    expect(screen.getByText("Priya Nair")).toBeInTheDocument();
    expect(screen.getByText("That sounds like the right kind of morning.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Like" })).toBeDisabled();
    expect(screen.getByText("2 likes")).toBeInTheDocument();
  });

  it("signs in, publishes a post, likes and comments", async () => {
    const posts: GqlPost[] = [morningPost];
    installGraphqlFetch((req, headers) => {
      const name = operationName(req.query);
      if (name === "Feed") return feedData(posts);
      if (name === "Users") return { users: [maya, priya] };
      if (name === "Me") return { me: headers.get("authorization") ? maya : null };
      if (name === "SignIn") {
        return { signIn: { token: "demo-token", user: maya } };
      }
      if (name === "CreatePost") {
        const body = String(req.variables?.["body"] ?? "");
        const created = makePost({
          id: "post_9",
          body,
          author: maya,
          createdAt: "2026-11-24T08:00:00.000Z",
        });
        posts.unshift(created);
        return { createPost: created };
      }
      if (name === "Like") {
        const current = posts[0];
        if (!current) return { like: morningPost };
        const liked = {
          ...current,
          likedByMe: !current.likedByMe,
          likeCount: current.likedByMe ? current.likeCount - 1 : current.likeCount + 1,
        };
        posts[0] = liked;
        return { like: liked };
      }
      if (name === "Comment") {
        const current = posts[0];
        if (!current) return {};
        const added = {
          id: "comment_9",
          postId: current.id,
          body: String(req.variables?.["body"] ?? ""),
          createdAt: "2026-11-24T08:05:00.000Z",
          author: maya,
        };
        const updated = {
          ...current,
          comments: [...current.comments, added],
          commentCount: current.commentCount + 1,
        };
        posts[0] = updated;
        return { comment: added };
      }
      throw new Error("unexpected operation " + name);
    });

    render(<App />);
    expect(await screen.findByText(/grey morning/)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Sign in as"), "maya");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(/Signed in as/)).toBeInTheDocument();
    expect(screen.getByText(/Maya Chen @maya/)).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("Write a post"), "Hello from the composer.");
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText("Hello from the composer.")).toBeInTheDocument();

    const like = screen.getAllByRole("button", { name: "Like" })[0];
    expect(like).toBeDefined();
    await userEvent.click(like!);
    expect(await screen.findByRole("button", { name: "Liked" })).toBeInTheDocument();

    await userEvent.type(screen.getAllByPlaceholderText("Write a comment")[0]!, "Nice walk.");
    await userEvent.click(screen.getAllByRole("button", { name: "Comment" })[0]!);
    expect(await screen.findByText("Nice walk.")).toBeInTheDocument();
  });
});

function numberedPosts(count: number): GqlPost[] {
  return Array.from({ length: count }, (_, index) =>
    makePost({
      id: `post_${index + 1}`,
      body: `Post number ${index + 1}`,
      author: priya,
    }),
  );
}

function pageFrom(posts: GqlPost[], first: number, after: string | undefined) {
  let start = 0;
  if (after) {
    const index = posts.findIndex((item) => item.id === after);
    start = index === -1 ? posts.length : index + 1;
  }
  const slice = posts.slice(start, start + first);
  const last = slice[slice.length - 1];
  return {
    feed: {
      totalCount: posts.length,
      pageInfo: {
        hasNextPage: start + slice.length < posts.length,
        hasPreviousPage: start > 0,
        startCursor: slice[0]?.id ?? null,
        endCursor: last ? last.id : null,
      },
      edges: slice.map((node) => ({ cursor: node.id, node })),
    },
  };
}

describe("pagination and optimistic updates", () => {
  it("loads the next page with a cursor", async () => {
    const posts = numberedPosts(8);
    installGraphqlFetch((req) => {
      const name = operationName(req.query);
      if (name === "Feed") {
        const first = Number(req.variables?.["first"] ?? 5);
        const after = typeof req.variables?.["after"] === "string" ? req.variables["after"] : undefined;
        return pageFrom(posts, first, after);
      }
      if (name === "Users") return { users: [maya, priya] };
      if (name === "Me") return { me: null };
      throw new Error("unexpected operation " + name);
    });

    render(<App />);
    expect(await screen.findByText("Post number 1")).toBeInTheDocument();
    expect(screen.getByText("Post number 5")).toBeInTheDocument();
    expect(screen.queryByText("Post number 6")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Post number 6")).toBeInTheDocument();
    expect(screen.getByText("Post number 8")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("likes and comments optimistically and rolls back on error", async () => {
    let settleLike: ((ok: boolean) => void) | undefined;
    let settleComment: ((ok: boolean) => void) | undefined;
    installGraphqlFetch((req, headers) => {
      const name = operationName(req.query);
      if (name === "Feed") return feedData([morningPost]);
      if (name === "Users") return { users: [maya, priya] };
      if (name === "Me") return { me: headers.get("authorization") ? maya : null };
      if (name === "SignIn") return { signIn: { token: "demo-token", user: maya } };
      if (name === "Like") {
        return new Promise((resolve) => {
          settleLike = (ok) => {
            if (ok) {
              resolve({
                like: { ...morningPost, likedByMe: true, likeCount: morningPost.likeCount + 1 },
              });
            } else {
              resolve(jsonResponse(null, [{ message: "Like failed" }]));
            }
          };
        });
      }
      if (name === "Comment") {
        return new Promise((resolve) => {
          settleComment = (ok) => {
            if (ok) {
              resolve({
                comment: {
                  id: "comment_9",
                  postId: morningPost.id,
                  body: String(req.variables?.["body"] ?? ""),
                  createdAt: "2026-11-24T08:05:00.000Z",
                  author: maya,
                },
              });
            } else {
              resolve(jsonResponse(null, [{ message: "Comment failed" }]));
            }
          };
        });
      }
      throw new Error("unexpected operation " + name);
    });

    render(<App />);
    expect(await screen.findByText(/grey morning/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Sign in as"), "maya");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(/Signed in as/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Like" }));
    expect(await screen.findByRole("button", { name: "Liked" })).toBeInTheDocument();
    settleLike?.(false);
    expect(await screen.findByRole("button", { name: "Like" })).toBeInTheDocument();
    expect(await screen.findByText("Like failed")).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("Write a comment"), "This should not stick.");
    await userEvent.click(screen.getByRole("button", { name: "Comment" }));
    expect(await screen.findByText("This should not stick.")).toBeInTheDocument();
    settleComment?.(false);
    expect(await screen.findByText("Comment failed")).toBeInTheDocument();
    expect(screen.queryByText("This should not stick.")).not.toBeInTheDocument();
  });
});
