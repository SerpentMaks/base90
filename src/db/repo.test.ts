import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { Base90DB } from './db';
import { createRepo } from './repo';
import { Rating, State } from '../lib/fsrs';

const T0 = new Date('2026-11-17T07:00:00Z'); // 10:00 МСК
let n = 0;
let d: Base90DB;
let r: ReturnType<typeof createRepo>;

beforeEach(() => {
  d = new Base90DB(`test-${n++}`);
  r = createRepo(d, () => 0.9);
});

describe('repo', () => {
  it('знакомство создаёт карточку «на слух» и считает новое слово дня', async () => {
    const c = await r.introduce('w_know', T0);
    expect(c.kind).toBe('listen');
    expect(c.fsrs.state).toBe(State.New);
    expect((await r.getDay('2026-11-17'))?.newIntroduced).toBe(1);
    await r.introduce('w_know', T0); // повторно — не дублирует
    expect(await d.cards.count()).toBe(1);
  });

  it('каждый ответ пишется в журнал; карточка сохраняется', async () => {
    let c = await r.introduce('w_go', T0);
    c = await r.answer(c, Rating.Again, { now: T0, elapsedMs: 4000, exerciseType: 'listen-choice' });
    expect(c.due - T0.getTime()).toBe(60_000);
    const logs = await d.reviewLogs.toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ cardId: 'listen:w_go', rating: Rating.Again, stateBefore: State.New, elapsedMs: 4000, studyDate: '2026-11-17' });
    expect((await r.getDay('2026-11-17'))?.reviewsDone).toBe(1);
  });

  it('после выхода «на слух» в расписание открывается «перевод → англ.» со следующего учебного дня', async () => {
    let c = await r.introduce('w_time', T0);
    c = await r.answer(c, Rating.Good, { now: T0, elapsedMs: 3000, exerciseType: 'listen-choice' });
    expect(await r.getCard('produce', 'w_time')).toBeUndefined();
    const t1 = new Date(c.due);
    c = await r.answer(c, Rating.Good, { now: t1, elapsedMs: 3000, exerciseType: 'listen-choice' });
    expect(c.fsrs.state).toBe(State.Review);
    const p = await r.getCard('produce', 'w_time');
    expect(p).toBeDefined();
    expect(new Date(p!.availableAt).toISOString()).toBe('2026-11-18T01:00:00.000Z'); // 04:00 МСК завтра
    expect(await r.dueCount(T0.getTime() + 3600_000)).toBe(0);
    expect(await r.dueCount(Date.parse('2026-11-18T02:00:00Z'))).toBe(1);
  });

  it('сессия сохраняется и восстанавливается; сброс очищает прогресс', async () => {
    await r.saveSession({ studyDate: '2026-11-17', startedAt: 1, queue: [{ type: 'intro', itemId: 'w_a' }], pending: [], lastItemId: null, answered: 0, correct: 0, introduced: [] });
    expect((await r.loadSession())?.queue).toHaveLength(1);
    await r.introduce('w_a', T0);
    await r.resetProgress();
    expect(await r.loadSession()).toBeNull();
    expect(await d.cards.count()).toBe(0);
  });
});
