/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Full GraphQL endpoint for deployed builds. Unset in dev, where Vite proxies /graphql. */
  readonly VITE_GRAPHQL_URL?: string;
}
