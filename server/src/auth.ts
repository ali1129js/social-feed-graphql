import { SignJWT, jwtVerify } from "jose";
import type { Store } from "./store.js";
import type { UserRecord } from "./types.js";

/** Local/dev fallback only. Set JWT_SECRET in a real deployment. Never commit a live secret. */
export const DEV_JWT_SECRET = "dev-only-not-a-real-secret";

const encoder = new TextEncoder();

export async function signToken(
  user: UserRecord,
  secret: string,
  expiresIn: string = "7d",
): Promise<string> {
  return new SignJWT({ handle: user.handle })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(encoder.encode(secret));
}

export async function readToken(
  token: string,
  secret: string,
): Promise<{ sub: string; handle: string } | undefined> {
  try {
    const { payload } = await jwtVerify(token, encoder.encode(secret));
    if (typeof payload.sub !== "string" || typeof payload.handle !== "string") return undefined;
    return { sub: payload.sub, handle: payload.handle };
  } catch {
    return undefined;
  }
}

export async function userFromRequest(
  request: Request,
  store: Store,
  secret: string,
): Promise<UserRecord | undefined> {
  const header = request.headers.get("authorization");
  if (!header) return undefined;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match?.[1]) return undefined;
  const claims = await readToken(match[1], secret);
  if (!claims) return undefined;
  const user = await store.getUser(claims.sub);
  if (!user || user.handle !== claims.handle) return undefined;
  return user;
}
