import js from "@eslint/js";
import globals from "globals";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import vueParser from "vue-eslint-parser";
import vue from "eslint-plugin-vue";

export default [
  { ignores: ["dist/**", "node_modules/**", "coverage/**", "playwright-report/**", "test-results/**"] },
  js.configs.recommended,
  ...vue.configs["flat/recommended"],
  {
    files: ["**/*.{ts,vue}"],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tsParser, ecmaVersion: "latest", sourceType: "module" },
      globals: { ...globals.browser, ...globals.node }
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      // TypeScript understands type-only usage; the base rule false-flags type imports.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // Vuetify slot names use dot modifiers (e.g. #item.name).
      "vue/valid-v-slot": ["error", { allowModifiers: true }],
      "vue/multi-word-component-names": "off",
      "no-undef": "off"
    }
  }
];
