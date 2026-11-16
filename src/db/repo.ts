/** Операции с прогрессом. Каждый ответ сохраняется сразу — подход можно прервать в любой момент. */
import { db, cardId, uuid, type Base90DB, type CardKind, type CardRow, type DayRow, type ReviewLogRow } from './db';
import { getScheduler, isGraduated, newFsrsCard, reviewFsrs, State, type Grade } from '../lib/fsrs';
import type { SessionState } from '../lib/session';
import { getSettings } from '../lib/settings';
import { nextStudyDayStartMs, studyDate } from '../lib/time';

export type Repo = ReturnType<typeof createRepo>;

export function createRepo(d: Base90DB, getRetention: () => number) {
  async function touchDay(date: string, patch: (day: DayRow) => void): Promise<void> {
    const day: DayRow = (await d.days.get(date)) ?? {
      date,
      plannedMin: 0,
      activeMin: 0,
      counted: 0,
      newIntroduced: 0,
      reviewsDone: 0,
      updatedAt: 0,
    };
    patch(day);
    day.updatedAt = Date.now();
    await d.days.put(day);
  }

  return {
    allCards: () => d.cards.toArray(),
    getCard: (kind: CardKind, itemId: string) => d.cards.get(cardId(kind, itemId)),

    /** Знакомство со словом → карточка «на слух» (новая, без оценки). */
    async introduce(itemId: string, now = new Date()): Promise<CardRow> {
      const existing = await d.cards.get(cardId('listen', itemId));
      if (existing) return existing;
      const s = await getScheduler(getRetention());
      const fsrs = newFsrsCard(s, now);
      const row: CardRow = {
        id: cardId('listen', itemId),
        itemId,
        kind: 'listen',
        fsrs,
        due: now.getTime(),
        availableAt: 0,
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      };
      await d.transaction('rw', d.cards, d.days, async () => {
        await d.cards.put(row);
        await touchDay(studyDate(now), (day) => day.newIntroduced++);
      });
      return row;
    },

    /**
     * Ответ на карточку: FSRS → новая карточка + запись в журнал (только добавление).
     * Когда «на слух» впервые выходит в расписание — открываем «перевод → англ.» со следующего учебного дня.
     */
    async answer(card: CardRow, grade: Grade, opts: { now?: Date; elapsedMs: number; exerciseType: string }): Promise<CardRow> {
      const now = opts.now ?? new Date();
      const s = await getScheduler(getRetention());
      const { card: next } = reviewFsrs(s, card.fsrs, grade, now);
      const updated: CardRow = { ...card, fsrs: next, due: new Date(next.dueAt).getTime(), updatedAt: now.getTime() };
      const log: ReviewLogRow = {
        id: uuid(),
        cardId: card.id,
        itemId: card.itemId,
        kind: card.kind,
        rating: grade,
        stateBefore: card.fsrs.state,
        reviewedAt: now.getTime(),
        studyDate: studyDate(now),
        elapsedMs: Math.round(opts.elapsedMs),
        exerciseType: opts.exerciseType,
      };
      await d.transaction('rw', d.cards, d.reviewLogs, d.days, async () => {
        await d.cards.put(updated);
        await d.reviewLogs.add(log);
        await touchDay(log.studyDate, (day) => day.reviewsDone++);
        if (card.kind === 'listen' && isGraduated(next) && !(await d.cards.get(cardId('produce', card.itemId)))) {
          const unlock = nextStudyDayStartMs(now);
          await d.cards.put({
            id: cardId('produce', card.itemId),
            itemId: card.itemId,
            kind: 'produce',
            fsrs: newFsrsCard(s, new Date(unlock)),
            due: unlock,
            availableAt: unlock,
            createdAt: now.getTime(),
            updatedAt: now.getTime(),
          });
        }
      });
      return updated;
    },

    async setSuspended(id: string, suspended: boolean): Promise<void> {
      await d.cards.update(id, { suspended: suspended ? 1 : 0, updatedAt: Date.now() });
    },

    async dueCount(now = Date.now()): Promise<number> {
      return d.cards.where('due').belowOrEqual(now).filter((c) => !c.suspended && c.availableAt <= now).count();
    },

    async stats(now = Date.now()) {
      const cards = await d.cards.toArray();
      const listen = cards.filter((c) => c.kind === 'listen');
      return {
        due: cards.filter((c) => !c.suspended && c.availableAt <= now && c.due <= now).length,
        started: listen.length,
        learning: listen.filter((c) => c.fsrs.state !== State.Review).length,
        nextDue: cards.filter((c) => !c.suspended && c.due > now).reduce((m, c) => Math.min(m, Math.max(c.due, c.availableAt)), Infinity),
      };
    },

    getDay: (date: string) => d.days.get(date),

    async saveSession(s: SessionState | null): Promise<void> {
      if (s) await d.progress.put({ key: 'session', value: s, updatedAt: Date.now() });
      else await d.progress.delete('session');
    },

    async loadSession(): Promise<SessionState | null> {
      const row = await d.progress.get('session');
      return (row?.value as SessionState | undefined) ?? null;
    },

    async resetProgress(): Promise<void> {
      await d.transaction('rw', [d.cards, d.reviewLogs, d.days, d.progress], async () => {
        await Promise.all([d.cards.clear(), d.reviewLogs.clear(), d.days.clear(), d.progress.clear()]);
      });
    },
  };
}

let instance: Repo | null = null;
export function repo(): Repo {
  if (!instance) instance = createRepo(db, () => getSettings().retention);
  return instance;
}
