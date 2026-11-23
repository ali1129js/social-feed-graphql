import { createYoga } from "graphql-yoga";
import { schema } from "./schema.js";

export function createApp() {
  return createYoga({ schema, graphqlEndpoint: "/graphql", logging: false });
}
