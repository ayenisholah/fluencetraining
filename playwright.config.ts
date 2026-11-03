import { defineConfig, devices } from "@playwright/test";

// Load .env.local for Clerk keys when running locally (Node 20.12+).
try {
  process.loadEnvFile(".env.local");
} catch {
  // not present (e.g. CI): rely on the environment
}

const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
// System Chrome locally; set PLAYWRIGHT_CHANNEL="" to use Playwright's Chromium (CI).
const channel = process.env.PLAYWRIGHT_CHANNEL === "" ? undefined : (process.env.PLAYWRIGHT_CHANNEL ?? "chrome");
const signedIn = Boolean(process.env.CLERK_SECRET_KEY) && process.env.E2E_SIGNED_IN !== "0";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, channel, trace: "retain-on-failure" },
  webServer: {
    command: process.env.CI ? `npm start -- --port ${PORT}` : `npm run build && npm start -- --port ${PORT}`,
    url: `${baseURL}/robots.txt`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
  projects: [
    { name: "mail-provider-setup", testMatch: /mail-provider\.setup\.ts/ },
    { name: "concurrency", testMatch: /concurrency-backend\.spec\.ts/, dependencies: ["mail-provider-setup"], use: { trace: "off" } },
    { name: "public", testMatch: /public\.spec\.ts/, use: { ...devices["Desktop Chrome"], channel } },
    { name: "public-mobile", testMatch: /public\.spec\.ts/, use: { ...devices["Pixel 7"], channel } },
    ...(signedIn
      ? [
          { name: "clerk-setup", testMatch: /global\.setup\.ts/, dependencies: ["mail-provider-setup"] },
          { name: "responsive", testMatch: /responsive\.spec\.ts/, dependencies: ["clerk-setup"], use: { ...devices["Desktop Chrome"], channel } },
          { name: "concurrency-ui", testMatch: /concurrency-ui\.spec\.ts/, dependencies: ["clerk-setup"], use: { ...devices["Desktop Chrome"], channel, trace: "off" as const } },
          {
            name: "signed-in",
            testMatch: /(signed-in|admin|automation|sign-in)\.spec\.ts/,
            dependencies: ["clerk-setup"],
            use: { ...devices["Desktop Chrome"], channel },
          },
        ]
      : []),
  ],
});
