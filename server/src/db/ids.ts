/** API ids look like "post_8"; the database stores the integer 8. */
export type IdPrefix = "user" | "post" | "comment" | "like";

const MAX_INT4 = 2_147_483_647;

/** Returns the numeric key, or undefined when the id is malformed or out of range. */
export function parseId(prefix: IdPrefix, id: string): number | undefined {
  const head = prefix + "_";
  if (!id.startsWith(head)) return undefined;
  const digits = id.slice(head.length);
  if (!/^[1-9][0-9]{0,9}$/.test(digits)) return undefined;
  const n = Number(digits);
  return n <= MAX_INT4 ? n : undefined;
}

export function formatId(prefix: IdPrefix, n: number): string {
  return prefix + "_" + n;
}
