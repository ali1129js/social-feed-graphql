import { Client, cacheExchange, fetchExchange } from "urql";
import { readToken } from "./auth";

export interface CreateClientOptions {
  url?: string;
  fetch?: typeof fetch;
  getToken?: () => string | undefined;
}

export function createUrqlClient(options: CreateClientOptions = {}): Client {
  const getToken = options.getToken ?? readToken;
  return new Client({
    url: options.url ?? "/graphql",
    exchanges: [cacheExchange, fetchExchange],
    // Call the current global fetch so tests can stub it after this module loads.
    preferGetMethod: false,
    fetch: options.fetch ?? ((input, init) => fetch(input, init)),
    fetchOptions: () => {
      const token = getToken();
      if (!token) return {};
      return { headers: { authorization: "Bearer " + token } };
    },
  });
}
