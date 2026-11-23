import { useQuery } from "urql";
import { FEED_QUERY, ME_QUERY } from "../graphql/documents";
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

export function FeedPage({ locale, strings, token, onAuthChange }: Props) {
  const [{ data, fetching, error }, reexecute] = useQuery({
    query: FEED_QUERY,
    variables: { first: FEED_PAGE_SIZE },
  });
  const [meResult, reexecuteMe] = useQuery({ query: ME_QUERY, pause: token === undefined });
  const me = token === undefined ? null : (meResult.data?.me ?? null);
  const refresh = () => {
    void reexecute({ requestPolicy: "network-only" });
    if (token) void reexecuteMe({ requestPolicy: "network-only" });
  };

  const feed = data?.feed;
  const edges = feed?.edges ?? [];
  const showLoading = fetching && !feed;
  const showError = Boolean(error) && !feed;
  const showEmpty = Boolean(feed) && edges.length === 0;

  return (
    <div className="feed-layout">
      <aside className="feed-side">
        <SignInBar
          strings={strings}
          me={me}
          onAuthChange={(next) => {
            onAuthChange(next);
          }}
        />
        {me ? (
          <Composer strings={strings} onCreated={refresh} />
        ) : (
          <p className="app-sub side-note">{strings.signInToPost}</p>
        )}
      </aside>
      <section className="feed-main" aria-labelledby="feed-heading">
        <h2 id="feed-heading">{strings.feedHeading}</h2>
        {showLoading ? <p className="status-block">{strings.loadingFeed}</p> : null}
        {showError ? (
          <div className="status-block" role="alert">
            <p>{strings.feedError}</p>
            <button type="button" className="button-primary" onClick={refresh}>
              {strings.retry}
            </button>
          </div>
        ) : null}
        {showEmpty ? <p className="status-block">{strings.emptyFeed}</p> : null}
        <div className="post-list">
          {edges.map((edge) => (
            <PostCard
              key={edge.node.id}
              post={edge.node}
              me={me}
              locale={locale}
              strings={strings}
              onChanged={refresh}
            />
          ))}
        </div>
        <p className="app-sub fictional-note">{strings.fictionalNote}</p>
      </section>
    </div>
  );
}
