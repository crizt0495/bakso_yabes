import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "poslocal.spec.ts",
  timeout: 60000,
  use: { baseURL: "http://localhost:3000" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
