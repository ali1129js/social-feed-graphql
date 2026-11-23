import { useState, type FormEvent } from "react";
import { useMutation } from "urql";
import { CREATE_POST_MUTATION } from "../graphql/documents";
import type { GqlPost } from "../graphql/types";
import { MAX_POST_BODY } from "../lib/limits";
import type { UIStrings } from "../lib/i18n";

interface Props {
  strings: UIStrings;
  onCreated: (post: GqlPost) => void;
}

export function Composer({ strings, onCreated }: Props) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [result, createPost] = useMutation(CREATE_POST_MUTATION);
  const remaining = MAX_POST_BODY - body.trim().length;
  const tooLong = body.trim().length > MAX_POST_BODY;
  const empty = body.trim().length === 0;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (empty || tooLong) return;
    setError(undefined);
    const response = await createPost({ body: body.trim() });
    if (response.error) {
      setError(response.error.graphQLErrors[0]?.message ?? response.error.message);
      return;
    }
    const created = response.data?.createPost;
    if (!created) return;
    setBody("");
    onCreated(created);
  }

  return (
    <section className="card panel" aria-labelledby="composer-heading">
      <h2 id="composer-heading">{strings.composerHeading}</h2>
      <form className="stack-form" onSubmit={onSubmit}>
        <label className="field">
          <span className="visually-hidden">{strings.composerPlaceholder}</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={strings.composerPlaceholder}
            rows={4}
            maxLength={MAX_POST_BODY + 20}
          />
        </label>
        <div className="form-row">
          <p className={tooLong ? "form-error" : "app-sub"}>{strings.remainingChars(Math.max(0, remaining))}</p>
          <button type="submit" className="button-primary" disabled={empty || tooLong || result.fetching}>
            {result.fetching ? strings.composerPublishing : strings.composerPublish}
          </button>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
