import type { DayRow, ReviewLogRow } from "../db/db";

export type TimeBudget = {
  start: number;
  step: number;
  period: number;
  cap: number;
};
export const DEFAULT_TIME: TimeBudget = {
  start: 20,
  step: 10,
  period: 3,
  cap: 90,
};
export const dayDistance = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
export function plannedMinutes(completed: number, t = DEFAULT_TIME): number {
  return Math.min(
    t.cap,
    t.start + t.step * Math.floor(Math.max(0, completed) / t.period),
  );
}
export function shares(day: number) {
  return day <= 30
    ? {
        review: 0.35,
        fresh: 0.25,
        grammar: 0.15,
        sounds: 0.15,
        listening: 0.1,
        stories: 0,
      }
    : day <= 60
      ? {
          review: 0.35,
          fresh: 0.2,
          grammar: 0.15,
          sounds: 0.1,
          listening: 0.15,
          stories: 0.05,
        }
      : {
          review: 0.35,
          fresh: 0.15,
          grammar: 0.1,
          sounds: 0.1,
          listening: 0.15,
          stories: 0.15,
        };
}
export function retention(logs: ReviewLogRow[], since: number): number | null {
  const recent = logs.filter(
    (l) => l.reviewedAt >= since && l.stateBefore === 2,
  );
  return recent.length
    ? recent.filter((l) => l.rating > 1).length / recent.length
    : null;
}
export function planDay(input: {
  today: string;
  days: DayRow[];
  due: number;
  newIntroduced: number;
  retention7: number | null;
  time?: TimeBudget;
}) {
  const time = input.time ?? DEFAULT_TIME;
  const prior = input.days
    .filter((d) => d.date < input.today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const completed = prior.filter((d) => d.counted).length;
  const studied = prior.filter((d) => d.activeMin > 0 || d.reviewsDone > 0);
  const last = studied.at(-1);
  const prev = studied.at(-2);
  const returning =
    !!last &&
    (dayDistance(last.date, input.today) >= 4 ||
      (!!prev && dayDistance(prev.date, last.date) >= 4));
  const minutes = Math.max(
    time.start,
    plannedMinutes(completed, time) - (returning ? time.step : 0),
  );
  const overloaded = input.due * 0.35 > minutes * 0.6;
  const lowRetention = input.retention7 !== null && input.retention7 < 0.8;
  let fresh = Math.max(
    5,
    Math.min(25, Math.round((minutes * shares(completed + 1).fresh) / 1.5)),
  );
  if (lowRetention) fresh = Math.floor(fresh * 0.7);
  if (overloaded || returning) fresh = 0;
  return {
    minutes,
    studyDay: completed + 1,
    fresh,
    newLeft: Math.max(0, fresh - input.newIntroduced),
    overloaded,
    returning,
    lowRetention,
  };
}

/** Заморозки рассчитываются из истории: перезагрузка не начисляет их повторно. */
export function streak(
  days: DayRow[],
  today: string,
  minimumDates: Set<string>,
) {
  const dates = days
    .filter((d) => d.activeMin >= 10 || minimumDates.has(d.date))
    .map((d) => d.date)
    .sort();
  let count = 0,
    best = 0,
    freezes = 0,
    earnedRun = 0,
    last: string | undefined;
  for (const date of dates) {
    if (last) {
      const gap = dayDistance(last, date) - 1;
      if (gap > freezes) {
        count = 0;
        earnedRun = 0;
      } else freezes -= gap;
    }
    count++;
    earnedRun++;
    if (earnedRun % 7 === 0) freezes = Math.min(2, freezes + 1);
    best = Math.max(best, count);
    last = date;
  }
  if (last) {
    const gap = Math.max(0, dayDistance(last, today) - 1);
    if (gap > freezes) count = 0;
    else freezes -= gap;
  }
  return { count, best, freezes };
}
