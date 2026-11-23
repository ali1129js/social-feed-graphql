import { vi } from "vitest";
import type { GqlPageInfo, GqlPost, GqlUser } from "../graphql/types";

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
}

export const maya: GqlUser = { id: "user_1", handle: "maya", displayName: "Maya Chen" };
export const noah: GqlUser = { id: "user_2", handle: "noah", displayName: "Noah Patel" };
export const priya: GqlUser = { id: "user_4", handle: "priya", displayName: "Priya Nair" };

export function emptyPageInfo(): GqlPageInfo {
  return { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null };
}

export function operationName(query: string): string {
  const match = /\b(query|mutation)\s+(\w+)/.exec(query);
  return match?.[2] ?? "";
}

export function jsonResponse(data: unknown, errors?: Array<{ message: string }>): Promise<Response> {
  const payload = errors ? { data, errors } : { data };
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

export function makePost(overrides: Partial<GqlPost> & Pick<GqlPost, "id" | "body" | "author">): GqlPost {
  return {
    createdAt: "2026-11-23T09:00:00.000Z",
    comments: [],
    likes: [],
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    ...overrides,
  };
}

export function feedData(posts: GqlPost[], pageInfo: GqlPageInfo = emptyPageInfo()) {
  return {
    feed: {
      totalCount: posts.length,
      pageInfo,
      edges: posts.map((node) => ({ cursor: node.id, node })),
    },
  };
}

export function readGraphqlRequest(input: RequestInfo | URL, init?: RequestInit): GraphQLRequest {
  const rawBody = typeof init?.body === "string" ? init.body : "";
  if (rawBody) return JSON.parse(rawBody) as GraphQLRequest;
  const url = input instanceof Request ? input.url : String(input);
  const parsed = new URL(url, "http://localhost");
  const query = parsed.searchParams.get("query") ?? "";
  const variables = parsed.searchParams.get("variables");
  const request: GraphQLRequest = { query };
  if (variables) request.variables = JSON.parse(variables) as Record<string, unknown>;
  return request;
}

export function requestHeaders(input: RequestInfo | URL, init?: RequestInit): Headers {
  if (init?.headers) return new Headers(init.headers);
  if (input instanceof Request) return input.headers;
  return new Headers();
}

export function installGraphqlFetch(
  handler: (req: GraphQLRequest, headers: Headers) => unknown | Response | Promise<unknown | Response>,
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = readGraphqlRequest(input, init);
    const result = await handler(body, requestHeaders(input, init));
    if (result instanceof Response) return result;
    return jsonResponse(result);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
