import { z } from "zod";

const TOKEN_KEY = "social-feed.v1.token";
const tokenSchema = z.string().min(1);

/** Reads the demo JWT. Missing or corrupt data is treated as signed out. */
export function readToken(): string | undefined {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (raw === null) return undefined;
    const parsed = tokenSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function writeToken(token: string | undefined): void {
  try {
    if (token === undefined) sessionStorage.removeItem(TOKEN_KEY);
    else sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  } catch {
    /* ignore */
  }
}
