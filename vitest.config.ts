import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/unit/**/*.spec.ts", "tests/component/**/*.spec.ts"],
    setupFiles: ["./tests/unit/setup.ts"]
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") }
  }
});
