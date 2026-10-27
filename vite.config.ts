import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: {
    preset: process.env.VERCEL ? "vercel" : "node-server",
  },

  tanstackStart: {
    // Preserve your existing SSR error wrapper.
    server: { entry: "server" },
  },
});

