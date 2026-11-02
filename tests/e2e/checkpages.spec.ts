import { test } from "@playwright/test";
test("pos check", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto("https://baksoyabes.vercel.app/login");
  await page.fill('input[autocomplete="username"]', "pemilik");
  await page.fill('input[autocomplete="current-password"]', "BaksoYabes2026!");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  await page.goto("https://baksoyabes.vercel.app/pos");
  await page.waitForTimeout(8000);
  const body = await page.textContent("body");
  console.log(`pos: errors=${JSON.stringify(errors)}, crashed=${body?.includes("couldn't load")}, bodyLen=${body?.length}`);
});
