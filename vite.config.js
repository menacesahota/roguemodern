import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  publicDir: "public",
  base: process.env.GITHUB_ACTIONS ? "/roguemodern/" : "/",
  server: {
    port: 5174,
    open: true,
  },
});
