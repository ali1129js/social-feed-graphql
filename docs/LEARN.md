# Learning notes

Short explanations of the ideas this project actually uses, and why they matter. Each one points at a file.

## GraphQL schema design

The schema is the contract. Types are `User`, `Post`, `Comment` and `Like`. Queries expose a health check, the signed-in user, a cursor-paginated `feed`, a single `post`, and the seeded `users` list used by the demo sign-in. Mutations cover `signIn`, `createPost`, `comment`, `like` (a toggle) and deleting your own post or comment.

The feed is a connection (`edges`, `pageInfo`, `totalCount`) rather than a bare array, so the client can ask for `first` items `after` a cursor without inventing its own paging. Post fields such as `likeCount`, `commentCount` and `likedByMe` are resolved from the store, not stored as denormalised columns. That keeps the in-memory model small and means a like is just a row in the like list.

See `typeDefs` in `server/src/schema.ts` and `paginate` in `server/src/paginate.ts`.

## Resolvers sit in front of a store

Resolvers do three things: check who is calling, validate input, then call the store. They do not hold data themselves. `createPost` and `comment` go through Zod schemas before `store.createPost` / `store.createComment`. Ownership checks for delete compare `post.authorId` or `comment.authorId` to `ctx.user.id` and return `FORBIDDEN` rather than pretending the row was missing. Store errors (`NOT_FOUND`, `CONFLICT`) are turned into GraphQL errors with the same codes so the client can tell a bad id from a crash.

Because the store is an interface, tests use the in-memory implementation, and a later database (SOC-06) can sit behind the same methods.

See `resolvers` in `server/src/schema.ts`, `server/src/validation.ts` and `server/src/store.ts`.

## Auth context

Yoga builds a fresh context on every request. `userFromRequest` reads the `Authorization: Bearer` header, verifies the JWT, and loads the user from the store. The resolver context is then `{ store, jwtSecret, user }`. Queries such as `me` and `likedByMe` just look at `ctx.user`. Mutations that change data call `requireAuth`, which throws `UNAUTHENTICATED` when `ctx.user` is missing.

Sign-in is a demo picker, not a password form: `signIn(handle)` finds a seeded user and returns a signed JWT. The token carries `sub` (user id) and `handle`. A well-signed token for a user who is no longer in the store is rejected. The fallback `DEV_JWT_SECRET` is only for local work; a real deploy must set `JWT_SECRET` and must not commit it.

See `server/src/context.ts`, `server/src/auth.ts` and the `context` function in `server/src/app.ts`.

## Optimistic UI

A like or a comment should feel instant. `PostCard` keeps an optional `optimistic` copy of the post and renders that instead of the server post while a mutation is in flight. On like, it flips `likedByMe` and adjusts `likeCount` immediately, then sends the mutation. On success it clears the overlay and writes the server post back through `onUpdated`. On error it drops the overlay so the last confirmed post shows again, and it displays the GraphQL error.

Comments work the same way, with a temporary `pending-comment` row that is replaced by the real comment after the mutation. A failed comment rolls back the same way. This is React state on one card, not a custom urql exchange, which keeps the rollback easy to test.

See `onLike` and `onComment` in `client/src/feed/PostCard.tsx`, and the rollback test in `client/src/test/feed.test.tsx`.
