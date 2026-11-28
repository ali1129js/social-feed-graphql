import { createYoga } from "graphql-yoga";
import { DEV_JWT_SECRET, userFromRequest } from "./auth.js";
import type { ResolverContext } from "./context.js";
import { schema } from "./schema.js";
import { seedData } from "./seed.js";
import { createMemoryStore } from "./store.js";
import type { Store } from "./store.js";

export interface AppOptions {
  store?: Store;
  jwtSecret?: string;
  /** Allowed browser origins. Unset keeps the Yoga default (reflect any origin). */
  corsOrigins?: string[];
}

/** Reads CORS_ORIGIN as a comma separated list, for example "https://ali1129js.github.io". */
export function parseCorsOrigins(raw: string | undefined): string[] | undefined {
  const list = (raw ?? "")
    .split(",")
    .map((item) => item.trim().replace(/\/$/, ""))
    .filter((item) => item.length > 0);
  return list.length > 0 ? list : undefined;
}

export function createApp(options: AppOptions = {}) {
  const store = options.store ?? createMemoryStore(seedData());
  const jwtSecret = options.jwtSecret ?? process.env["JWT_SECRET"] ?? DEV_JWT_SECRET;
  const corsOrigins = options.corsOrigins ?? parseCorsOrigins(process.env["CORS_ORIGIN"]);
  return createYoga({
    schema,
    ...(corsOrigins
      ? {
          cors: {
            origin: corsOrigins,
            methods: ["GET", "POST", "OPTIONS"],
            allowedHeaders: ["content-type", "authorization"],
            credentials: false,
          },
        }
      : {}),
    graphqlEndpoint: "/graphql",
    logging: false,
    // Validation and ownership errors are GraphQLError instances and should
    // reach the client. Masking is left off so Vitest's graphql bundling
    // cannot hide them as "Unexpected error."
    maskedErrors: false,
    context: async ({ request }): Promise<ResolverContext> => ({
      store,
      jwtSecret,
      user: await userFromRequest(request, store, jwtSecret),
    }),
  });
}
