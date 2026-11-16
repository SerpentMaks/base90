import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const course = JSON.parse(readFileSync("src/content/course.json", "utf8"));
async function countTable(
  page: import("@playwright/test").Page,
  table: string,
) {
  return page.evaluate(async (name) => {
    const request = indexedDB.open("base90");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<number>((resolve, reject) => {
      const r = database.transaction(name).objectStore(name).count();
      r.onsuccess = () => {
        resolve(r.result);
        database.close();
      };
      r.onerror = () => reject(r.error);
    });
  }, table);
}
test("онбординг и все основные экраны на мобильной ширине", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("");
  await expect(
    page.getByRole("heading", { name: "Добро пожаловать в Base90" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Дальше", exact: true }).click();
  await page.getByRole("button", { name: "Дальше", exact: true }).click();
  await page.getByRole("button", { name: "Отметить знакомые слова" }).click();
  await expect(
    page.getByRole("heading", { name: "Знакомые слова" }),
  ).toBeVisible();
  for (const route of [
    "today",
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
    await page.goto("#/" + route);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
test("неделя 1: десять заданий сохраняют FSRS и возвращаются после перезагрузки", async ({
  page,
}) => {
  await page.goto("#/practice/g_1");
  for (const d of course.lessons[0].drills) {
    if (d.mode === "tiles") {
      for (const token of d.en.replace(/[.!?]$/, "").split(" ")) {
        await page
          .getByRole("button", { name: token, exact: true })
          .last()
          .click();
      }
    } else
      await page.getByRole("textbox", { name: "Твой ответ" }).fill(d.answer);
    await page.getByRole("button", { name: "Проверить", exact: true }).click();
    await expect(page.getByText("Верно!", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Дальше", exact: true }).click();
  }
  await expect(
    page.getByRole("heading", { name: "Практика завершена ✓" }),
  ).toBeVisible();
  expect(await countTable(page, "cards")).toBe(10);
  expect(await countTable(page, "reviewLogs")).toBe(10);
  await page.reload();
  await page.goto("#/course");
  await expect(
    page.getByText("✓ 1. Я, ты и to be", { exact: true }),
  ).toBeVisible();
});
test("карточка знакомства продолжается с того же слова после перезагрузки", async ({
  page,
}) => {
  await page.goto("#/session/new");
  await expect(
    page.getByRole("button", { name: "Понятно, дальше" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Понятно, дальше" }).click();
  await expect.poll(() => countTable(page, "cards")).toBe(1);
  await expect(page.locator("h2[lang=en]").first()).toHaveText("the");
  const before = await page.locator("h2[lang=en]").first().textContent();
  await page.reload();
  await expect(page.locator("h2[lang=en]").first()).toHaveText(before!);
  expect(await countTable(page, "cards")).toBe(1);
});
test("диктант принимает перестановку букв как опечатку", async ({ page }) => {
  await page.goto("#/practice/dictation");
  await page.getByRole("textbox", { name: "Твой ответ" }).fill("I'm not srue.");
  await page.getByRole("button", { name: "Проверить", exact: true }).click();
  await expect(page.getByText("Почти!", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Дальше", exact: true }).click();
  await expect.poll(() => countTable(page, "reviewLogs")).toBe(1);
});
test("прогресс синхронизируется между двумя профилями через контракт Gist", async ({
  browser,
}) => {
  const gistId = "a".repeat(32);
  const files: Record<string, { content: string }> = {};
  const first = await browser.newContext(),
    second = await browser.newContext();
  for (const c of [first, second])
    await c.route("https://api.github.com/gists/**", async (route) => {
      const req = route.request();
      if (req.method() === "PATCH") {
        const body = req.postDataJSON();
        Object.assign(files, body.files);
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ id: gistId, public: false, files }),
      });
    });
  const a = await first.newPage(),
    b = await second.newPage();
  await a.goto("http://127.0.0.1:4173/base90/#/practice/g_1");
  await a.getByRole("textbox", { name: "Твой ответ" }).fill("am");
  await a.getByRole("button", { name: "Проверить", exact: true }).click();
  await a.getByRole("button", { name: "Дальше", exact: true }).click();
  for (const p of [a, b]) {
    await p.goto("http://127.0.0.1:4173/base90/#/settings");
    await p.getByLabel("Токен", { exact: true }).fill("test-only-credential");
    await p
      .getByLabel("ID существующего Gist (или оставь пустым)")
      .fill(gistId);
    await p.getByRole("button", { name: "Подключить", exact: true }).click();
    await expect(p.getByText("Gist подключён.", { exact: true })).toBeVisible();
  }
  expect(await countTable(b, "cards")).toBe(1);
  expect(await countTable(b, "reviewLogs")).toBe(1);
  const progress = JSON.parse(files["progress.json"]!.content);
  expect(progress.settings.some((r: { key: string }) => r.key === "sync")).toBe(
    false,
  );
  await first.close();
  await second.close();
});
test("офлайн: после установки SW страница и записанное слово доступны без сети", async ({
  page,
  context,
}) => {
  await page.goto("#/library");
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, {
    timeout: 45000,
  });
  const manifest = await page.evaluate(
    async () => await (await fetch("manifest.webmanifest")).json(),
  );
  expect(manifest.scope).toBe("/base90/");
  expect(manifest.start_url).toBe("/base90/");
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Словарь", exact: true }),
  ).toBeVisible();
  const cached = await page.evaluate(async () => {
    for (const name of await caches.keys()) {
      const keys = await (await caches.open(name)).keys();
      const key = keys.find((k) => k.url.includes("/audio/af_heart/"));
      if (key) {
        const url = new URL(key.url);
        url.search = "";
        const response = await fetch(url.href);
        const ranged = await fetch(url.href, {
          headers: { Range: "bytes=0-31" },
        });
        return {
          status: response.status,
          bytes: (await response.arrayBuffer()).byteLength,
          range: ranged.status,
          rangeBytes: (await ranged.arrayBuffer()).byteLength,
        };
      }
    }
    return { status: 0, bytes: 0, range: 0, rangeBytes: 0 };
  });
  expect(cached.status).toBe(200);
  expect(cached.bytes).toBeGreaterThan(100);
  expect(cached.range).toBe(206);
  expect(cached.rangeBytes).toBe(32);
});
test("экспорт и импорт возвращают карточки, а личный токен не попадает в файл", async ({
  page,
}) => {
  await page.goto("#/practice/g_1");
  await page.getByRole("textbox", { name: "Твой ответ" }).fill("am");
  await page.getByRole("button", { name: "Проверить", exact: true }).click();
  await page.getByRole("button", { name: "Дальше", exact: true }).click();
  await expect.poll(() => countTable(page, "cards")).toBe(1);
  await page.goto("#/settings");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт прогресса" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  const file = JSON.parse(readFileSync(path!, "utf8"));
  expect(file.cards.length).toBe(1);
  expect(file.settings.every((r: { key: string }) => r.key === "main")).toBe(
    true,
  );
  await page
    .getByRole("button", { name: "Сбросить прогресс", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Точно? Нажми ещё раз — всё обнулится" })
    .click();
  await expect.poll(() => countTable(page, "cards")).toBe(0);
  await page.getByLabel("Импорт копии").setInputFiles(path!);
  await expect(
    page.getByText("Прогресс объединён.", { exact: true }),
  ).toBeVisible();
  expect(await countTable(page, "cards")).toBe(1);
});
test("слово из субтитров сохраняется с переводом и доступно после перезагрузки", async ({
  page,
}) => {
  await page.goto("#/film");
  await page.locator("input[type=file]").setInputFiles({
    name: "sample.srt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "1\n00:00:01,000 --> 00:00:02,000\nLook at this spaceship!\n",
    ),
  });
  await page.getByLabel("Перевод spaceship").fill("космический корабль");
  await page.getByRole("button", { name: "Добавить своё слово" }).click();
  await expect.poll(() => countTable(page, "cards")).toBe(1);
  await page.reload();
  await page.goto("#/library");
  await page
    .getByRole("textbox", { name: "Поиск по словарю" })
    .fill("spaceship");
  await expect(
    page.getByText("космический корабль", { exact: false }),
  ).toBeVisible();
});

test("запись без разрешения микрофона оставляет режим вслух", async ({
  page,
}) => {
  await page.goto("#/practice/shadow");
  await page
    .getByRole("button", { name: "● Записать себя", exact: true })
    .click();
  await expect(
    page.getByText(
      "Микрофон недоступен. Послушай и повтори вслух — это тоже практика.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Повторил — дальше", exact: true }),
  ).toBeEnabled();
});

test("две записи подряд освобождают поток и создают разные локальные клипы", async () => {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  });
  const page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/base90/#/practice/shadow");
    let previous = "";
    for (let i = 0; i < 2; i++) {
      await page
        .getByRole("button", { name: "● Записать себя", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "■ Закончить запись", exact: true }),
      ).toBeVisible();
      await page.waitForTimeout(350);
      await page
        .getByRole("button", { name: "■ Закончить запись", exact: true })
        .click();
      await expect(
        page.locator('audio[aria-label="Твоя запись"]'),
      ).toBeVisible();
      // MediaRecorder завершает запись асинхронно: старый клип ещё виден
      // до события stop. Дожидаемся именно новой записи.
      if (previous)
        await expect(
          page.locator('audio[aria-label="Твоя запись"]'),
        ).not.toHaveAttribute("src", previous);
      const current = await page
        .locator('audio[aria-label="Твоя запись"]')
        .getAttribute("src");
      expect(current).toMatch(/^blob:/);
      expect(current).not.toBe(previous);
      previous = current!;
      await expect(
        page.getByRole("button", { name: "● Записать себя", exact: true }),
      ).toBeVisible();
    }
  } finally {
    await browser.close();
  }
});

test("отдельная практика возвращает текущий шаг после перезагрузки", async ({
  page,
}) => {
  await page.goto("#/practice/g_1");
  await page.getByRole("textbox", { name: "Твой ответ" }).fill("am");
  await page.getByRole("button", { name: "Проверить", exact: true }).click();
  await page.getByRole("button", { name: "Дальше", exact: true }).click();
  await expect(page.getByText("2 / 10", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("2 / 10", { exact: true })).toBeVisible();
  await expect(
    page.getByText("She ___ my friend.", { exact: true }),
  ).toBeVisible();
});

test("сбой сохранения очереди откатывает карточку и не дублирует ответ при повторе", async ({
  page,
}) => {
  await page.goto("#/session/new");
  await expect(
    page.getByRole("button", { name: "Понятно, дальше", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    let armed = true;
    IDBObjectStore.prototype.put = function (
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (
        this.name === "progress" &&
        (value as { key?: string })?.key === "session" &&
        armed
      ) {
        armed = false;
        throw new DOMException("Test quota", "QuotaExceededError");
      }
      return key === undefined
        ? original.call(this, value)
        : original.call(this, value, key);
    };
  });
  await page
    .getByRole("button", { name: "Понятно, дальше", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Ответ не сохранён");
  expect(await countTable(page, "cards")).toBe(0);
  await page
    .getByRole("button", { name: "Понятно, дальше", exact: true })
    .click();
  await expect(page.locator("h2[lang=en]")).toHaveText("the");
  expect(await countTable(page, "cards")).toBe(1);
});

test("общий подход проводит грамматику, звук, диктант и shadowing через FSRS", async ({
  page,
}) => {
  await page.goto("#/settings");
  await expect(
    page.getByRole("heading", { name: "Настройки", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    const r = indexedDB.open("base90");
    const d = await new Promise<IDBDatabase>((resolve) => {
      r.onsuccess = () => resolve(r.result);
    });
    const state = {
      studyDate: new Date(Date.now() - 3600000).toISOString().slice(0, 10),
      startedAt: Date.now(),
      queue: [
        { type: "drill", itemId: "g_1_1" },
        { type: "drill", itemId: "pair_0_0" },
        { type: "drill", itemId: "dict_w_be" },
        { type: "shadow", itemId: "w_be" },
      ],
      pending: [],
      lastItemId: null,
      answered: 0,
      correct: 0,
      introduced: [],
    };
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction("progress", "readwrite");
      tx.objectStore("progress").put({
        key: "session",
        value: state,
        updatedAt: Date.now(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    d.close();
  });
  await page.goto("#/session");
  for (let step = 0; step < 20; step++) {
    if (
      await page
        .getByRole("heading", { name: "Подход завершён", exact: true })
        .isVisible()
    )
      break;
    const task = await page.evaluate(async () => {
      const r = indexedDB.open("base90");
      const d = await new Promise<IDBDatabase>((resolve) => {
        r.onsuccess = () => resolve(r.result);
      });
      return new Promise<{ type: string; itemId: string } | null>((resolve) => {
        const q = d
          .transaction("progress")
          .objectStore("progress")
          .get("session");
        q.onsuccess = () => {
          resolve(q.result?.value.queue[0] ?? null);
          d.close();
        };
      });
    });
    if (!task) break;
    await expect(page.locator("[data-step]")).toHaveAttribute(
      "data-step",
      String(step),
    );
    if (task.type === "shadow") {
      await page
        .getByRole("button", { name: "Повторил — дальше", exact: true })
        .click();
    } else {
      if (task.itemId === "pair_0_0")
        await page.getByRole("button", { name: "west", exact: true }).click();
      else {
        await page
          .getByRole("textbox", { name: "Твой ответ" })
          .fill(task.itemId === "g_1_1" ? "am" : "I'm not sure.");
        await page
          .getByRole("button", { name: "Проверить", exact: true })
          .click();
      }
      await page.getByRole("button", { name: "Дальше", exact: true }).click();
    }
    await expect(page.locator("[data-step]")).toHaveAttribute(
      "data-step",
      String(step + 1),
    );
  }
  await expect(
    page.getByRole("heading", { name: "Подход завершён", exact: true }),
  ).toBeVisible();
  expect(await countTable(page, "cards")).toBe(4);
  expect(await countTable(page, "reviewLogs")).toBeGreaterThanOrEqual(8);
});

test("вопросы истории сохраняют ровно два правильных ответа после перезагрузки", async ({
  page,
}) => {
  const reading = course.readings[0];
  await page.goto("#/reader/" + reading.id);
  const total = reading.sentences.length + reading.questions.length;
  for (let i = 0; i < reading.sentences.length; i++) {
    await page
      .getByRole("button", { name: "Следующая фраза", exact: true })
      .click();
    await expect(
      page.getByText(`${i + 2} / ${total}`, { exact: true }),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: reading.questions[0].answer, exact: true })
    .click();
  await page.getByRole("button", { name: "Дальше", exact: true }).click();
  await expect(
    page.getByText(`${total} / ${total}`, { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: reading.questions[1].answer, exact: true })
    .click();
  await page.getByRole("button", { name: "Дальше", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Текст пройден ✓", exact: true }),
  ).toBeVisible();
  const result = await page.evaluate(async (key) => {
    const r = indexedDB.open("base90");
    const d = await new Promise<IDBDatabase>((resolve) => {
      r.onsuccess = () => resolve(r.result);
    });
    return new Promise<{ correct: number; total: number }>((resolve) => {
      const q = d.transaction("progress").objectStore("progress").get(key);
      q.onsuccess = () => {
        resolve(q.result.value);
        d.close();
      };
    });
  }, "reading:" + reading.id);
  expect(result).toEqual({ correct: 2, total: 2 });
});
