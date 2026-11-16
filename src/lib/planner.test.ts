import { describe, it, expect } from "vitest";
import { planDay, plannedMinutes, streak } from "./planner";
import type { DayRow } from "../db/db";
const day = (date: string, activeMin = 20): DayRow => ({
  date,
  plannedMin: 20,
  activeMin,
  counted: 1,
  newIntroduced: 0,
  reviewsDone: 1,
  updatedAt: 0,
});
describe("дневной план", () => {
  it("90 учебных дней дают 121 час и 945 элементов", () => {
    const days: DayRow[] = [];
    let minutes = 0,
      fresh = 0;
    for (let i = 0; i < 90; i++) {
      const today = new Date(Date.UTC(2026, 0, 1 + i))
        .toISOString()
        .slice(0, 10);
      const p = planDay({
        today,
        days,
        due: 0,
        newIntroduced: 0,
        retention7: 1,
      });
      minutes += p.minutes;
      fresh += p.fresh;
      days.push(day(today, p.minutes));
    }
    expect(minutes).toBe(7260);
    expect(fresh).toBe(945);
    expect(plannedMinutes(21)).toBe(90);
    expect(plannedMinutes(999)).toBe(90);
  });
  it("пропуски не повышают бюджет; возврат мягкий два учебных дня", () => {
    const days = Array.from({ length: 12 }, (_, i) =>
      day(`2026-01-${String(i + 1).padStart(2, "0")}`),
    );
    const input = {
      today: "2026-01-16",
      days,
      due: 0,
      newIntroduced: 0,
      retention7: 1,
    };
    expect(planDay(input)).toMatchObject({
      minutes: 50,
      returning: true,
      fresh: 0,
    });
    days.push(day("2026-01-16"));
    expect(planDay({ ...input, today: "2026-01-17" }).returning).toBe(true);
    days.push(day("2026-01-17"));
    expect(planDay({ ...input, today: "2026-01-18" }).returning).toBe(false);
  });
  it("при завале новые обнуляются, при плохой памяти уменьшаются", () => {
    const x = {
      today: "2026-01-01",
      days: [],
      due: 100,
      newIntroduced: 0,
      retention7: 1,
    };
    expect(planDay(x).fresh).toBe(0);
    expect(planDay({ ...x, due: 0, retention7: 0.79 }).fresh).toBe(3);
    expect(planDay({ ...x, due: 0, newIntroduced: 5 }).newLeft).toBe(0);
  });
  it("заморозка за семь дней тратится ровно один раз", () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      day(`2026-01-0${i + 1}`, 10),
    );
    expect(streak(days, "2026-01-08", new Set())).toMatchObject({
      count: 7,
      freezes: 1,
    });
    days.push(day("2026-01-09", 10));
    expect(streak(days, "2026-01-10", new Set())).toMatchObject({
      count: 8,
      freezes: 0,
    });
    expect(streak(days, "2026-01-12", new Set()).count).toBe(0);
  });
});
