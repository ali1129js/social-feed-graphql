import { useState, type FormEvent } from "react";
import { useMutation } from "urql";
import {
  COMMENT_MUTATION,
  DELETE_COMMENT_MUTATION,
  DELETE_POST_MUTATION,
  LIKE_MUTATION,
} from "../graphql/documents";
import type { GqlPost, GqlUser } from "../graphql/types";
import { formatPostTime } from "../lib/dates";
import type { UIStrings } from "../lib/i18n";
import { MAX_COMMENT_BODY } from "../lib/limits";
import type { LocaleName } from "../lib/types";

interface Props {
  post: GqlPost;
  me: GqlUser | null;
  locale: LocaleName;
  strings: UIStrings;
  onUpdated: (post: GqlPost) => void;
  onDeleted: (postId: string) => void;
}

export function PostCard({ post, me, locale, strings, onUpdated, onDeleted }: Props) {
  const [commentBody, setCommentBody] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [optimistic, setOptimistic] = useState<GqlPost | undefined>(undefined);
  const view = optimistic ?? post;
  const [likeResult, like] = useMutation(LIKE_MUTATION);
  const [commentResult, comment] = useMutation(COMMENT_MUTATION);
  const [deletePostResult, deletePost] = useMutation(DELETE_POST_MUTATION);
  const [deleteCommentResult, deleteComment] = useMutation(DELETE_COMMENT_MUTATION);
  const isAuthor = me?.id === view.author.id;
  const canReact = me !== null;
  const commentEmpty = commentBody.trim().length === 0;
  const commentTooLong = commentBody.trim().length > MAX_COMMENT_BODY;

  async function onLike() {
    if (!canReact || likeResult.fetching) return;
    setError(undefined);
    const snapshot = view;
    const nextLiked = !snapshot.likedByMe;
    setOptimistic({
      ...snapshot,
      likedByMe: nextLiked,
      likeCount: snapshot.likeCount + (nextLiked ? 1 : -1),
    });
    const result = await like({ postId: snapshot.id });
    if (result.error || !result.data) {
      setOptimistic(undefined);
      setError(result.error?.graphQLErrors[0]?.message ?? result.error?.message ?? "Like failed");
      return;
    }
    setOptimistic(undefined);
    onUpdated(result.data.like);
  }

  async function onComment(event: FormEvent) {
    event.preventDefault();
    if (!canReact || !me || commentEmpty || commentTooLong) return;
    setError(undefined);
    const body = commentBody.trim();
    const snapshot = view;
    const pending = {
      id: "pending-comment",
      postId: snapshot.id,
      body,
      createdAt: new Date().toISOString(),
      author: me,
    };
    setOptimistic({
      ...snapshot,
      comments: [...snapshot.comments, pending],
      commentCount: snapshot.commentCount + 1,
    });
    const result = await comment({ postId: snapshot.id, body });
    if (result.error || !result.data) {
      setOptimistic(undefined);
      setError(result.error?.graphQLErrors[0]?.message ?? result.error?.message ?? "Comment failed");
      return;
    }
    setOptimistic(undefined);
    setCommentBody("");
    onUpdated({
      ...snapshot,
      comments: [...snapshot.comments, result.data.comment],
      commentCount: snapshot.commentCount + 1,
    });
  }

  async function onDeletePost() {
    if (!isAuthor || deletePostResult.fetching) return;
    setError(undefined);
    const result = await deletePost({ postId: view.id });
    if (result.error) {
      setError(result.error.graphQLErrors[0]?.message ?? result.error.message);
      return;
    }
    onDeleted(view.id);
  }

  async function onDeleteComment(commentId: string) {
    if (deleteCommentResult.fetching) return;
    setError(undefined);
    const snapshot = view;
    setOptimistic({
      ...snapshot,
      comments: snapshot.comments.filter((item) => item.id !== commentId),
      commentCount: Math.max(0, snapshot.commentCount - 1),
    });
    const result = await deleteComment({ commentId });
    if (result.error) {
      setOptimistic(undefined);
      setError(result.error.graphQLErrors[0]?.message ?? result.error.message);
      return;
    }
    setOptimistic(undefined);
    onUpdated({
      ...snapshot,
      comments: snapshot.comments.filter((item) => item.id !== commentId),
      commentCount: Math.max(0, snapshot.commentCount - 1),
    });
  }

  return (
    <article className="card post-card">
      <header className="post-header">
        <div>
          <p className="post-author">
            <strong>{view.author.displayName}</strong>{" "}
            <span className="app-sub">@{view.author.handle}</span>
          </p>
          <time className="app-sub" dateTime={view.createdAt}>
            {formatPostTime(view.createdAt, locale)}
          </time>
        </div>
        {isAuthor ? (
          <button
            type="button"
            className="button-danger button-small"
            onClick={() => void onDeletePost()}
            disabled={deletePostResult.fetching}
          >
            {deletePostResult.fetching ? strings.deleting : strings.deletePost}
          </button>
        ) : null}
      </header>
      <p className="post-body">{view.body}</p>
      <div className="post-actions">
        <button
          type="button"
          className="button-secondary"
          aria-pressed={view.likedByMe}
          aria-label={view.likedByMe ? strings.liked : strings.like}
          onClick={() => void onLike()}
          disabled={!canReact || likeResult.fetching}
        >
          {view.likedByMe ? strings.liked : strings.like}
          <span aria-hidden="true"> · {view.likeCount}</span>
        </button>
        <span className="app-sub">{strings.likes(view.likeCount)}</span>
      </div>
      <section className="comments" aria-label={strings.commentHeading}>
        <h3>{strings.commentHeading}</h3>
        {view.comments.length === 0 ? <p className="app-sub">{strings.noComments}</p> : null}
        <ul className="comment-list">
          {view.comments.map((item) => (
            <li key={item.id} className="comment-item">
              <p>
                <strong>{item.author.displayName}</strong>{" "}
                <span className="app-sub">@{item.author.handle}</span>
              </p>
              <p>{item.body}</p>
              {me?.id === item.author.id ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => void onDeleteComment(item.id)}
                  disabled={deleteCommentResult.fetching}
                >
                  {strings.deleteComment}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {canReact ? (
          <form className="comment-form" onSubmit={onComment}>
            <label className="field">
              <span className="visually-hidden">{strings.commentPlaceholder}</span>
              <input
                type="text"
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                placeholder={strings.commentPlaceholder}
                maxLength={MAX_COMMENT_BODY + 20}
              />
            </label>
            <button
              type="submit"
              className="button-primary button-small"
              disabled={commentEmpty || commentTooLong || commentResult.fetching}
            >
              {commentResult.fetching ? strings.commentPosting : strings.commentAction}
            </button>
          </form>
        ) : (
          <p className="app-sub">{strings.signInToReact}</p>
        )}
      </section>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}
