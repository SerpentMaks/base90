import "fake-indexeddb/auto";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { db } from "../db/db";
import { ensureDay, recordActive, dailyPlan } from "./study";
import { studyDate } from "./time";
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-17T03:59:00+03:00"));
  vi.stubGlobal("window", new EventTarget());
  await db.open();
  await Promise.all([
    db.days.clear(),
    db.cards.clear(),
    db.reviewLogs.clear(),
    db.progress.clear(),
  ]);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("активное время засчитывается при 80%, до и после московской границы суток", async () => {
  await ensureDay();
  expect(studyDate()).toBe("2026-11-16");
  await recordActive(16 * 60000);
  expect((await dailyPlan()).activeMin).toBe(16);
  expect((await db.days.get("2026-11-16"))?.counted).toBe(1);
  vi.setSystemTime(new Date("2026-11-17T04:00:00+03:00"));
  await recordActive(60000);
  expect((await db.days.get("2026-11-17"))?.activeMin).toBe(1);
  expect((await db.days.get("2026-11-16"))?.activeMin).toBe(16);
});
it("день старой версии с нулевым планом получает нормальный бюджет", async () => {
  await db.days.put({
    date: studyDate(),
    plannedMin: 0,
    activeMin: 0,
    counted: 0,
    newIntroduced: 1,
    reviewsDone: 1,
    updatedAt: Date.now(),
  });
  await ensureDay();
  expect((await db.days.get(studyDate()))?.plannedMin).toBe(20);
  await recordActive(60000);
  expect((await db.days.get(studyDate()))?.counted).toBe(0);
});
