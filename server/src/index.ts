import { createServer } from "node:http";
import { createApp } from "./app.js";
import { createStoreFromEnv } from "./create-store.js";

const port = Number(process.env["PORT"] ?? 4000);
const { store, kind, close } = createStoreFromEnv();
const server = createServer(createApp({ store })).listen(port, () => {
  console.log("GraphQL server on http://localhost:" + port + "/graphql (" + kind + " store)");
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      void close().finally(() => process.exit(0));
    });
  });
}
