import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "checkpages.spec.ts",
  timeout: 90000,
  use: { baseURL: "https://baksoyabes.vercel.app" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
