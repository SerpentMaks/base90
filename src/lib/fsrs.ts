/**
 * Обёртка над ts-fsrs (алгоритм FSRS-6). Единственное место, где приложение
 * знает про библиотеку: остальной код работает с CardRow и Grade.
 */
import { DefaultScheduler, Rating, State, type DefaultSchedulerCard, type Grade } from 'ts-fsrs';

export type FsrsCard = DefaultSchedulerCard<'FSRS-6'>;
export type Scheduler = Awaited<ReturnType<typeof DefaultScheduler<'FSRS-6'>>>;
export type { Grade };
export { Rating, State };

export const DEFAULT_RETENTION = 0.9;

/**
 * Шаги изучения внутри сессии: новая карточка → проверка через ~1 мин → через ~10 мин,
 * только после этого — расписание по дням. Ошибка в повторении → снова шаг 10 мин.
 */
export const LEARNING_STEPS = ['1m', '10m'] as const;
export const RELEARNING_STEPS = ['10m'] as const;

const cache = new Map<string, Promise<Scheduler>>();

export function getScheduler(retention = DEFAULT_RETENTION, fuzz = true): Promise<Scheduler> {
  const r = Math.min(0.95, Math.max(0.85, retention));
  const key = `${r}|${fuzz}`;
  let s = cache.get(key);
  if (!s) {
    s = DefaultScheduler({
      version: 'FSRS-6',
      desiredRetention: r,
      enableShortTerm: true,
      learningSteps: [...LEARNING_STEPS],
      relearningSteps: [...RELEARNING_STEPS],
      enableFuzz: fuzz,
      maximumInterval: 36500,
    });
    cache.set(key, s);
  }
  return s;
}

export function newFsrsCard(s: Scheduler, now: Date): FsrsCard {
  return s.newCard({ now });
}

export function reviewFsrs(s: Scheduler, card: FsrsCard, grade: Grade, now: Date) {
  return s.review({ card, grade, now });
}

/** Карточка уже «выпустилась» из шагов изучения в расписание по дням. */
export function isGraduated(card: FsrsCard): boolean {
  return card.state === State.Review;
}

export type AutoResult = 'correct' | 'almost' | 'wrong';

/**
 * Оценка для автопроверяемых упражнений (§2.2): ошибка → Again;
 * «почти» (опечатка), подсказка или медленно → Hard; верно → Good. Easy автоматически не ставится.
 */
export function gradeAuto(result: AutoResult, opts: { elapsedMs: number; slowMs: number; usedHint?: boolean }): Grade {
  if (result === 'wrong') return Rating.Again;
  if (result === 'almost' || opts.usedHint || opts.elapsedMs > opts.slowMs) return Rating.Hard;
  return Rating.Good;
}

/** Порог «медленно» для типов упражнений, мс. */
export const SLOW_MS = {
  'listen-choice': 9_000,
  'produce': 15_000,
} as const;
