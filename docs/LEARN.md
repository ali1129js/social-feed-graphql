# Learning notes

Short explanations of the ideas this project actually uses, and why they matter. Each one points at a file.

## GraphQL schema design

The schema is the contract. Types are `User`, `Post`, `Comment` and `Like`. Queries expose a health check, the signed-in user, a cursor-paginated `feed`, a single `post`, and the seeded `users` list used by the demo sign-in. Mutations cover `signIn`, `createPost`, `comment`, `like` (a toggle) and deleting your own post or comment.

The feed is a connection (`edges`, `pageInfo`, `totalCount`) rather than a bare array, so the client can ask for `first` items `after` a cursor without inventing its own paging. Post fields such as `likeCount`, `commentCount` and `likedByMe` are resolved from the store, so the schema does not care how the numbers are kept. In Postgres `likeCount` is a counter column that is updated in the same transaction as the like row (see the database section below).

See `typeDefs` in `server/src/schema.ts` and `toConnection` in `server/src/paginate.ts`.

## Resolvers sit in front of a store

Resolvers do three things: check who is calling, validate input, then call the store. They do not hold data themselves. `createPost` and `comment` go through Zod schemas before `store.createPost` / `store.createComment`. Ownership checks for delete compare `post.authorId` or `comment.authorId` to `ctx.user.id` and return `FORBIDDEN` rather than pretending the row was missing. Store errors (`NOT_FOUND`, `CONFLICT`) are turned into GraphQL errors with the same codes so the client can tell a bad id from a crash.

Because the store is an interface, the same resolvers run on the in-memory implementation and on the Postgres one (SOC-06, see below).

See `resolvers` in `server/src/schema.ts`, `server/src/validation.ts` and `server/src/store.ts`.

## Auth context

Yoga builds a fresh context on every request. `userFromRequest` reads the `Authorization: Bearer` header, verifies the JWT, and loads the user from the store. The resolver context is then `{ store, jwtSecret, user }`. Queries such as `me` and `likedByMe` just look at `ctx.user`. Mutations that change data call `requireAuth`, which throws `UNAUTHENTICATED` when `ctx.user` is missing.

Sign-in is a demo picker, not a password form: `signIn(handle)` finds a seeded user and returns a signed JWT. The token carries `sub` (user id) and `handle`. A well-signed token for a user who is no longer in the store is rejected. The fallback `DEV_JWT_SECRET` is only for local work; a real deploy must set `JWT_SECRET` and must not commit it.

See `server/src/context.ts`, `server/src/auth.ts` and the `context` function in `server/src/app.ts`.

## Optimistic UI

A like or a comment should feel instant. `PostCard` keeps an optional `optimistic` copy of the post and renders that instead of the server post while a mutation is in flight. On like, it flips `likedByMe` and adjusts `likeCount` immediately, then sends the mutation. On success it clears the overlay and writes the server post back through `onUpdated`. On error it drops the overlay so the last confirmed post shows again, and it displays the GraphQL error.

Comments work the same way, with a temporary `pending-comment` row that is replaced by the real comment after the mutation. A failed comment rolls back the same way. This is React state on one card, not a custom urql exchange, which keeps the rollback easy to test.

See `onLike` and `onComment` in `client/src/feed/PostCard.tsx`, and the rollback test in `client/src/test/feed.test.tsx`.

## Why Postgres for a feed (and not SQLite or MongoDB)

A feed is relational. Users write posts, posts have comments and likes, and nearly every screen joins them: "newest posts, with author name, like count and whether I liked it". Postgres is built for that, and it enforces the rules itself: a foreign key stops a like pointing at a deleted post, and a unique index stops the same person liking twice, even if two requests arrive at the same moment.

SQLite speaks the same SQL and is great for tests and small tools. It allows one writer at a time, and on a host with a throwaway disk (Render's free tier) a plain file is lost on restart, the same problem the in-memory store had. A hosted SQLite such as Turso fixes that, but Postgres is the more reusable skill.

MongoDB stores documents. That suits records that are read whole (a product page, a log line). A feed needs the opposite: pieces of many records stitched together. You either copy author data into every post and keep the copies in sync, or reference by id and do the joins by hand in code. A schema you enforce yourself (Zod, Mongoose) is also weaker than one the database enforces.

Neon is hosted Postgres with a free plan. It is plain Postgres, so nothing in the code is Neon-specific: only the connection string changes.

## Drizzle schema

Drizzle lets you describe tables in TypeScript and get typed queries back, while you still see the SQL it runs. `server/src/db/schema.ts` defines four tables:

- `users`: unique handle, compared in lower case.
- `posts`: author, body, `created_at`, and a `like_count` counter with a check that it never goes below zero.
- `comments`: post, author, body, `created_at`.
- `likes`: post, user, `created_at`, with a unique index on `(post_id, user_id)`.

Foreign keys use `ON DELETE CASCADE`, so deleting a post removes its comments and likes in the database, which is what the in-memory store did by hand. Keys are serial integers; `server/src/db/ids.ts` turns `8` into `post_8` and back, so the GraphQL ids and cursors look exactly as before.

The feed index is `posts (created_at DESC, id DESC)`. It matches the query's `ORDER BY`, so Postgres can read the first page straight off the index.

## Cursor pagination in SQL

The cursor is still a post id. To get the page after it, the store asks for rows whose `(created_at, id)` pair is smaller than the cursor row's pair:

    WHERE (created_at, id) < (SELECT created_at, id FROM posts WHERE id = $cursor)
    ORDER BY created_at DESC, id DESC
    LIMIT first + 1

The extra row tells us whether a next page exists. The `id` in the pair is the tie-breaker: two posts can share a timestamp, and without it one of them could be skipped or shown twice. New posts do not shift an old cursor, because the cursor names a row, not a position. The in-memory store sorts the same way, and one test suite checks both.

## Migrations

A migration is a numbered SQL file that moves the database from one schema to the next. The flow:

1. Change `server/src/db/schema.ts`.
2. Run `npm --prefix server run db:generate`. drizzle-kit compares the schema with its last snapshot and writes a new file into `server/drizzle/`.
3. Read the SQL, then commit it together with the schema change.
4. Run `npm --prefix server run db:migrate` against each database. Drizzle records which files ran, so it only applies the new ones.

Never edit a migration that has already run somewhere. Add a new one instead. `db:seed` loads the fictional demo data with its original ids and is safe to run twice.

## The store interface pattern

`Store` in `server/src/store.ts` lists every storage operation the resolvers need. There are two implementations: `createMemoryStore` and `createPostgresStore` (`server/src/store-postgres.ts`). `createStoreFromEnv` picks one: `DATABASE_URL` set means Postgres, otherwise memory.

The methods return promises. An in-memory store could be synchronous, but a database cannot, so the interface is async and the memory store resolves immediately. That one change is why resolvers gained `await`; their logic did not change.

Both stores must behave identically, including errors: a duplicate like is a `CONFLICT`, a missing row is `NOT_FOUND`, an unknown cursor is `BAD_CURSOR`. To keep them honest, Vitest runs the whole server suite in two projects (`memory` and `pglite`, see `server/vitest.config.ts`). PGlite is real Postgres compiled to run inside Node, so tests need no server and no account.

## Transactions and like counts

Liking a post changes two things: a row in `likes` and the `like_count` on the post. If only one change landed, the number on screen would be wrong forever. A transaction groups both statements so they succeed or fail together.

`addLike` inserts the like with `ON CONFLICT DO NOTHING` on `(post_id, user_id)`. If nothing was inserted, the user already liked the post, so it reports `CONFLICT` and the counter is untouched. If a row was inserted, the counter goes up by one in the same transaction. `removeLike` deletes the row and lowers the counter the same way. The unique index decides the winner when two requests race, so the database, not application code, guarantees one like per user.

The trade-off: a counter is a copy of information the `likes` table already holds. It makes the feed cheap to read, but every write path must keep it in step. `server/src/store-postgres.test.ts` checks exactly that.
