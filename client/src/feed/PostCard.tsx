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
  onChanged: () => void;
}

export function PostCard({ post, me, locale, strings, onChanged }: Props) {
  const [commentBody, setCommentBody] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [likeResult, like] = useMutation(LIKE_MUTATION);
  const [commentResult, comment] = useMutation(COMMENT_MUTATION);
  const [deletePostResult, deletePost] = useMutation(DELETE_POST_MUTATION);
  const [deleteCommentResult, deleteComment] = useMutation(DELETE_COMMENT_MUTATION);
  const isAuthor = me?.id === post.author.id;
  const canReact = me !== null;
  const commentEmpty = commentBody.trim().length === 0;
  const commentTooLong = commentBody.trim().length > MAX_COMMENT_BODY;

  async function onLike() {
    if (!canReact || likeResult.fetching) return;
    setError(undefined);
    const result = await like({ postId: post.id });
    if (result.error) {
      setError(result.error.graphQLErrors[0]?.message ?? result.error.message);
      return;
    }
    onChanged();
  }

  async function onComment(event: FormEvent) {
    event.preventDefault();
    if (!canReact || commentEmpty || commentTooLong) return;
    setError(undefined);
    const result = await comment({ postId: post.id, body: commentBody.trim() });
    if (result.error) {
      setError(result.error.graphQLErrors[0]?.message ?? result.error.message);
      return;
    }
    setCommentBody("");
    onChanged();
  }

  async function onDeletePost() {
    if (!isAuthor || deletePostResult.fetching) return;
    setError(undefined);
    const result = await deletePost({ postId: post.id });
    if (result.error) {
      setError(result.error.graphQLErrors[0]?.message ?? result.error.message);
      return;
    }
    onChanged();
  }

  async function onDeleteComment(commentId: string) {
    if (deleteCommentResult.fetching) return;
    setError(undefined);
    const result = await deleteComment({ commentId });
    if (result.error) {
      setError(result.error.graphQLErrors[0]?.message ?? result.error.message);
      return;
    }
    onChanged();
  }

  return (
    <article className="card post-card">
      <header className="post-header">
        <div>
          <p className="post-author">
            <strong>{post.author.displayName}</strong>{" "}
            <span className="app-sub">@{post.author.handle}</span>
          </p>
          <time className="app-sub" dateTime={post.createdAt}>
            {formatPostTime(post.createdAt, locale)}
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
      <p className="post-body">{post.body}</p>
      <div className="post-actions">
        <button
          type="button"
          className="button-secondary"
          aria-pressed={post.likedByMe}
          aria-label={post.likedByMe ? strings.liked : strings.like}
          onClick={() => void onLike()}
          disabled={!canReact || likeResult.fetching}
        >
          {post.likedByMe ? strings.liked : strings.like}
          <span aria-hidden="true"> · {post.likeCount}</span>
        </button>
        <span className="app-sub">{strings.likes(post.likeCount)}</span>
      </div>
      <section className="comments" aria-label={strings.commentHeading}>
        <h3>{strings.commentHeading}</h3>
        {post.comments.length === 0 ? <p className="app-sub">{strings.noComments}</p> : null}
        <ul className="comment-list">
          {post.comments.map((item) => (
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
