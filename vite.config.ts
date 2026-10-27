import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({


  tanstackStart: {
    // Preserve your existing SSR error wrapper.
    server: { entry: "server" },
  },
  nitro: {
   traceDeps: ["mongodb"],
  },
});

