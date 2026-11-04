import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: { alias: { "@": root } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "convex",
          environment: "edge-runtime",
          server: { deps: { inline: ["convex-test"] } },
          include: ["convex/**/*.test.ts"],
        },
      },
      {
        // Runs the Code nodes from the exported n8n workflow JSON. Node, not
        // edge-runtime: n8n Code nodes use require("crypto").
        extends: true,
        test: {
          name: "n8n",
          environment: "node",
          include: ["n8n/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["components/**/*.test.tsx", "lib/**/*.test.ts"],
          setupFiles: ["./test/setup-ui.ts"],
        },
      },
      {
        // Every story is a test: render, play function, then axe (a11y: "error").
        // Runs in real Chrome; set PLAYWRIGHT_CHANNEL="" to use Playwright's Chromium.
        extends: true,
        plugins: [storybookTest({ configDir: `${root}.storybook` })],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({
              launchOptions: {
                channel:
                  process.env.PLAYWRIGHT_CHANNEL === "" ? undefined : (process.env.PLAYWRIGHT_CHANNEL ?? "chrome"),
              },
            }),
            instances: [{ browser: "chromium" }],
          },
          setupFiles: [".storybook/vitest.setup.ts"],
        },
      },
    ],
  },
});
