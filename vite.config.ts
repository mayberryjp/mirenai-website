import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    port: 3030,
    strictPort: true,
    proxy: {
      // mirenai paths are exact (e.g. /policies); strip the /api prefix
      // used by the axios client so dev matches the nginx reverse proxy.
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, "")
      }
    }
  },
  build: {
    sourcemap: true,
    target: "es2022"
  }
});
