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

export function toConnection<T extends { id: string }>(
  page: { posts: T[]; hasNextPage: boolean; hasPreviousPage: boolean; totalCount: number },
): Connection<T> {
  const firstItem = page.posts[0];
  const lastItem = page.posts[page.posts.length - 1];
  return {
    edges: page.posts.map((node) => ({ cursor: node.id, node })),
    pageInfo: {
      hasNextPage: page.hasNextPage,
      hasPreviousPage: page.hasPreviousPage,
      startCursor: firstItem ? firstItem.id : null,
      endCursor: lastItem ? lastItem.id : null,
    },
    totalCount: page.totalCount,
  };
}
