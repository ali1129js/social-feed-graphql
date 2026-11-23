# Social Feed (GraphQL)

A small social feed built as a monorepo: a TypeScript GraphQL server and a React client. All people and posts are fictional example data.

Status: scaffold. The server answers a health query and the client shows the themed shell. Schema, auth, the feed list, pagination and deployment come in the next steps.

## Layout

- server/: Node, TypeScript, GraphQL Yoga, tests with Vitest.
- client/: Vite, React 19, strict TypeScript, gloss colour scheme (Khaki, Graphite, Midnight), motion toggle (static by default), English and German.

## Run it

    npm run install:all
    npm run dev:server   # http://localhost:4000/graphql
    npm run dev:client   # Vite proxies /graphql to the server
    npm test             # server and client tests
    npm run typecheck
    npm run build

## Notes

- Themes: light and dark only, no high-contrast theme. Contrast tests cover text and borders in every theme.
- Desktop first; phones scroll and stay usable.
- client/scripts/leak-guard.mjs scans the client for terms that must not appear in a public repo (npm --prefix client run guard).

## Licence

MIT, see LICENSE.
