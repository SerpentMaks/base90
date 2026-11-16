import { db, type DayRow } from "../db/db";
import { repo } from "../db/repo";
import { getSettings } from "./settings";
import { planDay, retention, streak } from "./planner";
import { studyDate } from "./time";

export async function dailyPlan() {
  const today = studyDate();
  const [days, logs, cards] = await Promise.all([
    db.days.toArray(),
    db.reviewLogs.toArray(),
    repo().allCards(),
  ]);
  const row = days.find((d) => d.date === today);
  const p = planDay({
    today,
    days,
    due: cards.filter(
      (c) => !c.suspended && c.due <= Date.now() && c.availableAt <= Date.now(),
    ).length,
    newIntroduced: row?.newIntroduced ?? 0,
    retention7: retention(logs, Date.now() - 7 * 86_400_000),
    time: getSettings().time,
  });
  const mins = await db.progress.toArray();
  const minimumDates = new Set(
    mins
      .filter((x) => x.key.startsWith("minimum:") && x.value === true)
      .map((x) => x.key.slice(8)),
  );
  return {
    ...p,
    minutes: row?.plannedMin || p.minutes,
    activeMin: row?.activeMin ?? 0,
    streak: streak(days, today, minimumDates),
  };
}

export async function ensureDay() {
  const date = studyDate();
  if (
    (await db.days.get(date))?.plannedMin &&
    (await db.progress.get(`morning:${date}`))
  )
    return;
  const plan = await dailyPlan();
  await db.transaction("rw", db.days, db.progress, db.cards, async () => {
    const existing = await db.days.get(date);
    if (!existing) {
      await db.days.put({
        date,
        plannedMin: plan.minutes,
        activeMin: 0,
        counted: 0,
        newIntroduced: 0,
        reviewsDone: 0,
        updatedAt: Date.now(),
      });
    } else if (!existing.plannedMin)
      await db.days.update(date, {
        plannedMin: plan.minutes,
        updatedAt: Date.now(),
      });
    const key = `morning:${date}`;
    if (!(await db.progress.get(key))) {
      const due = (await db.cards.toArray())
        .filter(
          (c) =>
            !c.suspended && c.due <= Date.now() && c.availableAt <= Date.now(),
        )
        .map((c) => c.id);
      await db.progress.put({ key, value: due, updatedAt: Date.now() });
    }
  });
}

export async function recordActive(ms: number) {
  if (ms <= 0) return;
  await ensureDay();
  const date = studyDate();
  await db.transaction(
    "rw",
    db.days,
    db.progress,
    db.cards,
    db.reviewLogs,
    async () => {
      const day = (await db.days.get(date)) as DayRow;
      day.activeMin += ms / 60_000;
      day.counted = day.activeMin >= day.plannedMin * 0.8 ? 1 : 0;
      day.updatedAt = Date.now();
      await db.days.put(day);
      const morning = (await db.progress.get(`morning:${date}`))?.value as
        string[] | undefined;
      if (morning?.length) {
        const answered = new Set(
          (await db.reviewLogs.where("studyDate").equals(date).toArray()).map(
            (l) => l.cardId,
          ),
        );
        const all = await db.cards.bulkGet(morning);
        if (all.every((c) => !c || c.suspended || answered.has(c.id))) {
          await db.progress.put({
            key: `minimum:${date}`,
            value: true,
            updatedAt: Date.now(),
          });
        }
      }
    },
  );
  window.dispatchEvent(new Event("study-update"));
}

/** Одна очередь записи; в фоне и спустя 60 секунд без действий время не растёт. */
export function trackActivity() {
  let lastInput = performance.now(),
    lastTick = performance.now(),
    pending = Promise.resolve();
  const activity = () => {
    lastInput = performance.now();
  };
  const tick = () => {
    const now = performance.now();
    const activeRoute = /^#\/(session|practice|reader|lesson|test)/.test(
      location.hash,
    );
    const elapsed = Math.max(0, Math.min(now, lastInput + 60_000) - lastTick);
    if (document.visibilityState === "visible" && activeRoute && elapsed > 0) {
      pending = pending
        .then(() => recordActive(Math.min(elapsed, 5000)))
        .catch(() => {});
    }
    lastTick = now;
  };
  const visible = () => {
    lastTick = performance.now();
    lastInput = performance.now();
  };
  const events = ["pointerdown", "keydown", "touchstart"] as const;
  events.forEach((e) =>
    window.addEventListener(e, activity, { passive: true }),
  );
  document.addEventListener("visibilitychange", visible);
  const id = window.setInterval(tick, 1000);
  return () => {
    clearInterval(id);
    events.forEach((e) => window.removeEventListener(e, activity));
    document.removeEventListener("visibilitychange", visible);
  };
}
