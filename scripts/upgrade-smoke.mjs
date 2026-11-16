// Реальная проверка обновления опубликованного сайта: отдельный временный браузерный профиль.
// Ждёт локальный маркер успешного деплоя, исходные данные владельца не использует.
import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
const marker = process.argv[2];
if (!marker) throw Error("Укажи путь к маркеру успешного деплоя");
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
try {
  await page.goto("https://serpentmaks.github.io/base90/", {
    waitUntil: "networkidle",
  });
  console.log("Старая версия:", await page.locator("footer").innerText());
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.getByRole("button", { name: "Начать", exact: true }).click();
  await page
    .getByRole("button", { name: "Понятно, дальше", exact: true })
    .click();
  await page.waitForFunction(async () => {
    const r = indexedDB.open("base90");
    const d = await new Promise((resolve) => {
      r.onsuccess = () => resolve(r.result);
    });
    return new Promise((resolve) => {
      const q = d.transaction("cards").objectStore("cards").count();
      q.onsuccess = () => {
        resolve(q.result > 0);
        d.close();
      };
    });
  });
  await page
    .getByRole("button", { name: "Пауза — прогресс сохранится" })
    .click();
  console.log("Синтетический прогресс сохранён. Жду маркер деплоя:", marker);
  while (!existsSync(marker))
    await new Promise((resolve) => setTimeout(resolve, 1000));
  await page.evaluate(async () => {
    const r = await navigator.serviceWorker.ready;
    await r.update();
  });
  await page
    .getByRole("button", { name: "Обновить", exact: true })
    .waitFor({ timeout: 600000 });
  await page.getByRole("button", { name: "Обновить", exact: true }).click();
  await page.waitForFunction(
    () => document.body.innerText.includes("Версия 1.0.0"),
    undefined,
    { timeout: 120000 },
  );
  const cards = await page.evaluate(async () => {
    const r = indexedDB.open("base90");
    const d = await new Promise((resolve) => {
      r.onsuccess = () => resolve(r.result);
    });
    return new Promise((resolve) => {
      const q = d.transaction("cards").objectStore("cards").count();
      q.onsuccess = () => {
        resolve(q.result);
        d.close();
      };
    });
  });
  if (cards < 1) throw Error("После обновления потеряны карточки");
  console.log(
    "✓ Переход с 0.2.0 на 1.0.0: карточки сохранены, новое приложение загрузилось",
  );
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page
    .getByRole("button", { name: "Понятно, дальше", exact: true })
    .waitFor();
  console.log("✓ Незаконченный подход старой версии продолжается");
} finally {
  await browser.close();
}
