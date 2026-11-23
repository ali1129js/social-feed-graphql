import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "urql";
import { SIGN_IN_MUTATION, USERS_QUERY } from "../graphql/documents";
import type { GqlUser } from "../graphql/types";
import type { UIStrings } from "../lib/i18n";

interface Props {
  strings: UIStrings;
  me: GqlUser | null;
  onAuthChange: (token: string | undefined) => void;
}

export function SignInBar({ strings, me, onAuthChange }: Props) {
  const [{ data, fetching }] = useQuery({ query: USERS_QUERY });
  const [signInResult, signIn] = useMutation(SIGN_IN_MUTATION);
  const users = data?.users ?? [];
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | undefined>();

  if (me) {
    return (
      <section className="card panel" aria-labelledby="signin-heading">
        <h2 id="signin-heading">{strings.signInHeading}</h2>
        <p>
          {strings.signedInAs}{" "}
          <strong>
            {me.displayName} @{me.handle}
          </strong>
        </p>
        <button type="button" className="button-secondary" onClick={() => onAuthChange(undefined)}>
          {strings.signOut}
        </button>
      </section>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!handle) return;
    setError(undefined);
    const result = await signIn({ handle });
    if (result.error) {
      setError(result.error.graphQLErrors[0]?.message ?? result.error.message);
      return;
    }
    const token = result.data?.signIn.token;
    if (token) onAuthChange(token);
  }

  return (
    <section className="card panel" aria-labelledby="signin-heading">
      <h2 id="signin-heading">{strings.signInHeading}</h2>
      <p className="app-sub">{strings.signInHelp}</p>
      <form className="stack-form" onSubmit={onSubmit}>
        <label className="field">
          <span>{strings.signInAs}</span>
          <select
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            disabled={fetching || users.length === 0}
          >
            <option value="">{strings.pickUser}</option>
            {users.map((user) => (
              <option key={user.id} value={user.handle}>
                {user.displayName} (@{user.handle})
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="button-primary"
          disabled={!handle || signInResult.fetching}
        >
          {signInResult.fetching ? strings.signingIn : strings.signInAction}
        </button>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
