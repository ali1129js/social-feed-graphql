import { createYoga } from "graphql-yoga";
import type { ResolverContext } from "./context.js";
import { schema } from "./schema.js";
import { seedData } from "./seed.js";
import { createMemoryStore } from "./store.js";
import type { Store } from "./store.js";

export interface AppOptions {
  store?: Store;
}

export function createApp(options: AppOptions = {}) {
  const store = options.store ?? createMemoryStore(seedData());
  return createYoga({
    schema,
    graphqlEndpoint: "/graphql",
    logging: false,
    // Validation and ownership errors are GraphQLError instances and should
    // reach the client. Masking is left off so Vitest's graphql bundling
    // cannot hide them as "Unexpected error."
    maskedErrors: false,
    context: (): ResolverContext => ({ store }),
  });
}
