import { test } from "@playwright/test";
test("pos local", async ({ page }) => {
  await page.goto("http://localhost:3000/login");
  await page.waitForTimeout(2000);
  const btnType = await page.locator('button').getAttribute('type');
  console.log("Button type:", btnType);
  await page.fill('input[autocomplete="username"]', "pemilik");
  await page.fill('input[autocomplete="current-password"]', "BaksoYabes2026!");
  // Submit form via JS
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) form.requestSubmit();
  });
  await page.waitForTimeout(5000);
  console.log("URL after submit:", page.url());
});
