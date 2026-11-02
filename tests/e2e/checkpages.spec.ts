import { test } from "@playwright/test";
const PAGES = ["/dashboard", "/pos", "/transactions", "/products", "/recipes", "/inventory", "/purchases", "/finance", "/customers", "/orders", "/qr-menu", "/reports", "/settings"];
test.describe("all pages", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("https://baksoyabes.vercel.app/login");
    await page.fill('input[autocomplete="username"]', "pemilik");
    await page.fill('input[autocomplete="current-password"]', "BaksoYabes2026!");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  });
  for (const p of PAGES) {
    test(`page ${p}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      await page.goto(`https://baksoyabes.vercel.app${p}`);
      await page.waitForTimeout(8000);
      const body = await page.textContent("body");
      const crashed = body?.includes("couldn't load") ?? false;
      console.log(`${p}: crashed=${crashed}, errors=${JSON.stringify(errors)}, bodyLen=${body?.length}`);
      expect(crashed).toBe(false);
    });
  }
});
