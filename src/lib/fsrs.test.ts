import { describe, expect, it } from 'vitest';
import { getScheduler, isGraduated, newFsrsCard, Rating, reviewFsrs, State } from './fsrs';

const T0 = new Date('2026-11-17T07:00:00Z');
const min = (d: Date | string, from: Date) => Math.round((new Date(d).getTime() - from.getTime()) / 60000);

describe('FSRS-обёртка: шаги изучения', () => {
  it('новая карточка: Again → повтор через 1 мин, Good → через 10 мин', async () => {
    const s = await getScheduler(0.9, false);
    const c = newFsrsCard(s, T0);
    expect(min(reviewFsrs(s, c, Rating.Again, T0).card.dueAt, T0)).toBe(1);
    expect(min(reviewFsrs(s, c, Rating.Good, T0).card.dueAt, T0)).toBe(10);
  });

  it('после шагов карточка уходит в расписание по дням', async () => {
    const s = await getScheduler(0.9, false);
    let c = newFsrsCard(s, T0);
    c = reviewFsrs(s, c, Rating.Good, T0).card; // → шаг 10 мин
    expect(isGraduated(c)).toBe(false);
    const t1 = new Date(c.dueAt);
    c = reviewFsrs(s, c, Rating.Good, t1).card;
    expect(isGraduated(c)).toBe(true);
    expect(min(c.dueAt, t1)).toBeGreaterThanOrEqual(24 * 60);
  });

  it('ошибка в повторении → переучивание через 10 мин, интервал потом меньше', async () => {
    const s = await getScheduler(0.9, false);
    let c = newFsrsCard(s, T0);
    c = reviewFsrs(s, c, Rating.Good, T0).card;
    c = reviewFsrs(s, c, Rating.Good, new Date(c.dueAt)).card;
    const before = c.stability;
    const t = new Date(c.dueAt);
    c = reviewFsrs(s, c, Rating.Again, t).card;
    expect(c.state).toBe(State.Relearning);
    expect(min(c.dueAt, t)).toBe(10);
    expect(c.stability).toBeLessThan(before);
    expect(c.lapses).toBe(1);
  });

  it('удерживаемость выше → интервалы короче', async () => {
    const lo = await getScheduler(0.85, false);
    const hi = await getScheduler(0.95, false);
    const run = (s: typeof lo) => {
      let c = newFsrsCard(s, T0);
      c = reviewFsrs(s, c, Rating.Good, T0).card;
      c = reviewFsrs(s, c, Rating.Good, new Date(c.dueAt)).card;
      c = reviewFsrs(s, c, Rating.Good, new Date(c.dueAt)).card;
      return c.scheduledDays;
    };
    expect(run(hi)).toBeLessThan(run(lo));
  });

  it('удерживаемость ограничена диапазоном 0.85–0.95', async () => {
    expect(await getScheduler(0.5, false)).toBe(await getScheduler(0.85, false));
  });
});
