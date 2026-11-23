import type { Store } from "./store.js";
import type { UserRecord } from "./types.js";

export interface ResolverContext {
  store: Store;
  jwtSecret: string;
  user: UserRecord | undefined;
}
