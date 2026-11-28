/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // "./" works anywhere; the Pages workflow sets VITE_BASE=/social-feed-graphql/.
  base: process.env["VITE_BASE"] ?? "./",
  server: { proxy: { "/graphql": "http://localhost:4000" } },
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
