import { defineConfig, devices } from "@playwright/test";

const STAGING_URL = process.env.BASE_URL || "https://sidedoor-replit-staging.up.railway.app";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // Serial — billing tests depend on order
  workers: 1,
  retries: 1,
  timeout: 60_000, // 60s per test (Stripe redirects can be slow)
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: STAGING_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
