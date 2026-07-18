import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "**/.local/**",
      "**/.agents/**",
      "**/generated/**",
      "**/*.tsbuildinfo",
      "attached_assets/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      // Generated/scaffolded code and route handlers use `any` deliberately in
      // a few places (e.g. request bodies pre-validation) — warn, don't block.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-empty-object-type": "warn",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      // `declare global { namespace Express { ... } }` is the standard,
      // TypeScript-documented way to augment Express's Request type — not
      // legacy namespace usage.
      "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true }],
    },
  },
  {
    files: ["artifacts/farm-clicker/src/**/*.{ts,tsx}", "artifacts/farm-admin/src/**/*.{ts,tsx}", "artifacts/mockup-sandbox/src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // Only the two long-standing, stable rules — not the newer React
      // Compiler-oriented rules (set-state-in-effect, purity, etc.), which
      // are experimental and flag widely-used, non-buggy patterns.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["artifacts/api-server/src/**/*.ts", "scripts/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ["**/*.mjs", "**/*.cjs"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
