import { chromium } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:4173/base90/");
await page.waitForTimeout(1500);
console.log("first", await page.locator("h1").innerText());
await page.goto("http://127.0.0.1:4173/base90/#/today");
await page.waitForTimeout(500);
console.log("today", await page.locator("h1").innerText());
await page.screenshot({ path: "/tmp/base90-today.png", fullPage: true });
for (const route of [
  "course",
  "lesson/g_1",
  "practice/g_1",
  "practice/sounds",
  "practice/dictation",
  "practice/shadow",
  "library",
  "stats",
  "settings",
  "film",
  "reader/r_1",
  "test/28",
]) {
  await page.goto("http://127.0.0.1:4173/base90/#/" + route);
  await page.waitForTimeout(350);
  console.log(
    route,
    await page.locator("h1").innerText(),
    "overflow",
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  );
}
await page.goto("http://127.0.0.1:4173/base90/#/today");
await page.getByRole("button", { name: "Начать", exact: true }).click();
await page.waitForTimeout(400);
console.log("session", await page.locator("main").innerText());
await page.screenshot({ path: "/tmp/base90-session.png", fullPage: true });
console.log("ERRORS", errors);
await browser.close();
if (errors.length) process.exitCode = 1;
