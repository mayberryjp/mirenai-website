import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import path from "path";

export default defineConfig({
  // autoImport keeps only used components (smallest prod bundle + fewest dev chunks);
  // styles:"none" + the precompiled vuetify/dist/vuetify.css (main.ts) means no
  // per-component CSS requests in dev.
  plugins: [vue(), vuetify({ autoImport: true, styles: "none" })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    port: 3030,
    strictPort: true
  },
  build: {
    sourcemap: true,
    target: "es2022"
  }
});
