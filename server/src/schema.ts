import { createSchema } from "graphql-yoga";

export const typeDefs = [
  "type Query {",
  "  health: Health!",
  "}",
  "type Health {",
  "  ok: Boolean!",
  "  service: String!",
  "}",
].join("\n");

export const resolvers = {
  Query: {
    health: () => ({ ok: true, service: "social-feed-server" }),
  },
};

export const schema = createSchema({ typeDefs, resolvers });
