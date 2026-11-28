import { useEffect, useState } from "react";
import { useQuery } from "urql";
import { FEED_QUERY, ME_QUERY } from "../graphql/documents";
import type { FeedQueryVars, GqlPageInfo, GqlPost } from "../graphql/types";
import type { UIStrings } from "../lib/i18n";
import { FEED_PAGE_SIZE } from "../lib/limits";
import type { LocaleName } from "../lib/types";
import { Composer } from "./Composer";
import { PostCard } from "./PostCard";
import { SignInBar } from "./SignInBar";

interface Props {
  locale: LocaleName;
  strings: UIStrings;
  token: string | undefined;
  onAuthChange: (token: string | undefined) => void;
}

function mergePosts(existing: GqlPost[], incoming: GqlPost[]): GqlPost[] {
  const ids = new Set(incoming.map((post) => post.id));
  return [...existing.filter((post) => !ids.has(post.id)), ...incoming];
}

export function FeedPage({ locale, strings, token, onAuthChange }: Props) {
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<GqlPost[]>([]);
  const [pageInfo, setPageInfo] = useState<GqlPageInfo>({
    hasNextPage: false,
    hasPreviousPage: false,
    startCursor: null,
    endCursor: null,
  });
  const [pageError, setPageError] = useState<string | undefined>(undefined);

  const variables: FeedQueryVars = { first: FEED_PAGE_SIZE };
  if (cursor !== undefined) variables.after = cursor;

  const [{ data, fetching, error }, reexecute] = useQuery({
    query: FEED_QUERY,
    variables,
  });
  const [meResult, reexecuteMe] = useQuery({ query: ME_QUERY, pause: token === undefined });
  const me = token === undefined ? null : (meResult.data?.me ?? null);
  const feed = data?.feed;

  useEffect(() => {
    if (!feed) return;
    const incoming = feed.edges.map((edge) => edge.node);
    setItems((prev) => (cursor === undefined ? incoming : mergePosts(prev, incoming)));
    setPageInfo(feed.pageInfo);
    setPageError(undefined);
  }, [feed, cursor]);

  useEffect(() => {
    if (error && cursor !== undefined) setPageError(strings.loadMoreError);
  }, [error, cursor, strings.loadMoreError]);

  function reloadFirstPage() {
    setCursor(undefined);
    void reexecute({ requestPolicy: "network-only" });
    if (token) void reexecuteMe({ requestPolicy: "network-only" });
  }

  function upsertPost(post: GqlPost) {
    setItems((prev) => {
      const index = prev.findIndex((item) => item.id === post.id);
      if (index === -1) return [post, ...prev];
      const next = [...prev];
      next[index] = post;
      return next;
    });
  }

  function removePost(postId: string) {
    setItems((prev) => prev.filter((item) => item.id !== postId));
  }

  const showLoading = fetching && items.length === 0 && cursor === undefined;
  const showError = Boolean(error) && items.length === 0 && cursor === undefined;
  const showEmpty = !fetching && !error && items.length === 0;
  const showLoadMore = pageInfo.hasNextPage;

  return (
    <div className="feed-layout">
      <aside className="feed-side">
        <SignInBar strings={strings} me={me} onAuthChange={onAuthChange} />
        {me ? (
          <Composer strings={strings} onCreated={upsertPost} />
        ) : (
          <p className="app-sub side-note">{strings.signInToPost}</p>
        )}
      </aside>
      <section className="feed-main" aria-labelledby="feed-heading">
        <h2 id="feed-heading">{strings.feedHeading}</h2>
        {showLoading ? (
          <div className="status-block" role="status">
            <p>{strings.loadingFeed}</p>
            <p className="app-sub">{strings.coldStartNote}</p>
          </div>
        ) : null}
        {showError ? (
          <div className="status-block" role="alert">
            <p>{strings.feedError}</p>
            <button type="button" className="button-primary" onClick={reloadFirstPage}>
              {strings.retry}
            </button>
          </div>
        ) : null}
        {showEmpty ? <p className="status-block">{strings.emptyFeed}</p> : null}
        <div className="post-list">
          {items.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              me={me}
              locale={locale}
              strings={strings}
              onUpdated={upsertPost}
              onDeleted={removePost}
            />
          ))}
        </div>
        {showLoadMore ? (
          <div className="load-more">
            <button
              type="button"
              className="button-secondary"
              disabled={fetching}
              onClick={() => {
                if (pageInfo.endCursor) setCursor(pageInfo.endCursor);
              }}
            >
              {fetching ? strings.loadingMore : strings.loadMore}
            </button>
            {pageError ? (
              <p className="form-error" role="alert">
                {pageError}
              </p>
            ) : null}
          </div>
        ) : null}
        <p className="app-sub fictional-note">{strings.fictionalNote}</p>
      </section>
    </div>
  );
}
