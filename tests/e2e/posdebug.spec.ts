import { test } from "@playwright/test";
test("pos debug", async ({ page }) => {
  page.on("pageerror", (err) => console.log("PAGEERROR:", JSON.stringify(err.message), "\nSTACK:", err.stack));
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") console.log("CONSOLE", msg.type(), msg.text());
  });
  await page.goto("https://baksoyabes.vercel.app/login");
  await page.fill('input[autocomplete="username"]', "pemilik");
  await page.fill('input[autocomplete="current-password"]', "BaksoYabes2026!");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  console.log("URL after login:", page.url());
  await page.goto("https://baksoyabes.vercel.app/pos");
  await page.waitForTimeout(10000);
  console.log("FINAL URL:", page.url());
  const crashed = await page.textContent("body");
  console.log("CRASHED:", crashed?.includes("couldn't load"));
});
