import { GraphQLError } from "graphql";

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface Connection<T> {
  edges: Array<{ cursor: string; node: T }>;
  pageInfo: PageInfo;
  totalCount: number;
}

export function paginate<T extends { id: string }>(
  items: T[],
  first: number,
  after?: string,
): Connection<T> {
  let start = 0;
  if (after !== undefined) {
    const index = items.findIndex((item) => item.id === after);
    if (index === -1) {
      throw new GraphQLError("Invalid cursor", { extensions: { code: "BAD_USER_INPUT" } });
    }
    start = index + 1;
  }
  const slice = items.slice(start, start + first);
  const end = start + slice.length;
  const firstItem = slice[0];
  const lastItem = slice[slice.length - 1];
  return {
    edges: slice.map((node) => ({ cursor: node.id, node })),
    pageInfo: {
      hasNextPage: end < items.length,
      hasPreviousPage: start > 0,
      startCursor: firstItem ? firstItem.id : null,
      endCursor: lastItem ? lastItem.id : null,
    },
    totalCount: items.length,
  };
}
