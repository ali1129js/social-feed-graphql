import { GraphQLError } from "graphql";
import { z } from "zod";

export const MAX_POST_BODY = 500;
export const MAX_COMMENT_BODY = 280;
export const DEFAULT_FEED_FIRST = 20;
export const MAX_FEED_FIRST = 50;

export const idSchema = z.string().trim().min(1, "Id is required");

export const postBodySchema = z
  .string()
  .trim()
  .min(1, "Post body cannot be empty")
  .max(MAX_POST_BODY, `Post body must be at most ${MAX_POST_BODY} characters`);

export const commentBodySchema = z
  .string()
  .trim()
  .min(1, "Comment body cannot be empty")
  .max(MAX_COMMENT_BODY, `Comment body must be at most ${MAX_COMMENT_BODY} characters`);

export const feedArgsSchema = z.object({
  first: z
    .number()
    .int()
    .min(1, "first must be at least 1")
    .max(MAX_FEED_FIRST, `first must be at most ${MAX_FEED_FIRST}`)
    .optional(),
  after: z.string().min(1).nullable().optional(),
});

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Invalid input";
    throw new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
  }
  return result.data;
}
