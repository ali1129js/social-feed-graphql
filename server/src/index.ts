import { createServer } from "node:http";
import { createApp } from "./app.js";

const port = Number(process.env["PORT"] ?? 4000);
createServer(createApp()).listen(port, () => {
  console.log("GraphQL server on http://localhost:" + port + "/graphql");
});
