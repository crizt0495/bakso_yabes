import { defineConfig, devices } from "@playwright/test";

/**
 * E2E Playwright. Beberapa spec membutuhkan Supabase terhubung
 * (.env.local). Spec smoke UI dapat berjalan tanpa kredensial.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // Tampilan HP (Chromium-Pixel supaya dapat berjalan dgn chromium)
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    // Tampilan laptop
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 800 } } },
  ],
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
        // smoke test tidak butuh Supabase nyata — nilai contoh agar client
        // tidak crash dan halaman menangani error dengan baik.
        env: {
          NEXT_PUBLIC_SUPABASE_URL: "https://e2e-dummy.supabase.co",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "dummy-anon-key-for-smoke-tests",
        },
      },
});
