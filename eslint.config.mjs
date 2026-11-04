import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Repo conventions (docs/CONTRIBUTING.md) enforced so humans and agents can't drift from them.
    rules: {
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-restricted-globals": [
        "error",
        { name: "confirm", message: "Use useConfirm() from components/ui (ConfirmDialog)." },
        { name: "alert", message: "Show feedback with the Alert/Toast components." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "confirm", message: "Use useConfirm() from components/ui (ConfirmDialog)." },
        { object: "window", property: "alert", message: "Show feedback with the Alert/Toast components." },
      ],
    },
  },
  {
    // The browser bundle imports these, so they must stay free of server-only code.
    files: [
      "convex/lib/rules.ts",
      "convex/lib/people.ts",
      "lib/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "app/**/*.{ts,tsx}",
    ],
    ignores: ["**/*.test.{ts,tsx}", "**/*.stories.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/convex/_generated/server", "**/convex/lib/auth", "**/convex/lib/outbox"],
              message: "Server-only Convex code. Call it through api.* from convex/_generated/api.",
            },
          ],
        },
      ],
    },
  },
  {
    // Scripts and tests talk to the terminal.
    files: ["scripts/**", "e2e/**", "**/*.test.{ts,tsx}", "convex/dev.ts", "convex/migrations.ts", ".storybook/**"],
    rules: { "no-console": "off" },
  },
  // Formatting belongs to Prettier; keep this last.
  prettier,
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "convex/_generated/**",
    // AWS CDK app: own package, own lint config (infra/eslint.config.mjs).
    "infra/**",
    "storybook-static/**",
    "playwright-report/**",
    "playwright-responsive-results/**",
    "test-results/**",
    "email-previews/**",
  ]),
]);

export default eslintConfig;
