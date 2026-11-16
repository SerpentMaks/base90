/**
 * Движок сессии (§4.3) — чистая логика без базы и UI, покрыта тестами.
 * Порядок: разминка (3 лёгких повторения) → повторения и шаги изучения вперемешку →
 * новые слова пачками по 3 (знакомство → сразу проверка) → в конце — оставшиеся шаги.
 */
import type { CardRow } from "../db/db";
import { State } from "./fsrs";

export type TaskType =
  | "intro"
  | "listen-choice"
  | "listen-self"
  | "produce"
  | "drill"
  | "lesson"
  | "reader"
  | "shadow";
export type Task = { type: TaskType; itemId: string };

export type SessionState = {
  studyDate: string;
  startedAt: number;
  queue: Task[];
  /** Карточки на шагах изучения: вернутся, когда подойдёт время (или в конце сессии). */
  pending: { task: Task; dueAt: number }[];
  lastItemId: string | null;
  answered: number;
  correct: number;
  introduced: string[];
};

/** Карточки с повтором в пределах этого окна возвращаются в текущую сессию. */
export const SESSION_HORIZON_MS = 30 * 60_000;
export const WARMUP = 3;
export const NEW_BATCH = 3;
export const MAX_RUN = 5;

export function taskForCard(card: CardRow): Task {
  if (card.kind === "shadow") return { type: "shadow", itemId: card.itemId };
  if (card.kind !== "listen" && card.kind !== "produce")
    return { type: "drill", itemId: card.itemId };
  if (card.kind === "produce") return { type: "produce", itemId: card.itemId };
  // На ранних шагах — выбор из 4 (легче), на повторениях — самооценка.
  return {
    type: card.fsrs.state === State.Review ? "listen-self" : "listen-choice",
    itemId: card.itemId,
  };
}

/** Переставляет задачи так, чтобы подряд было не больше maxRun одного типа. */
export function interleave(tasks: Task[], maxRun = MAX_RUN): Task[] {
  const rest = [...tasks];
  const out: Task[] = [];
  while (rest.length) {
    const tail = out.slice(-maxRun);
    const blocked =
      tail.length === maxRun && tail.every((t) => t.type === tail[0]!.type)
        ? tail[0]!.type
        : null;
    const i = blocked ? rest.findIndex((t) => t.type !== blocked) : 0;
    out.push(rest.splice(i === -1 ? 0 : i, 1)[0]!);
  }
  return out;
}

export type BuildInput = {
  cards: CardRow[];
  /** id слов в порядке изучения (по rank). */
  wordOrder: string[];
  now: number;
  newLimit: number;
  reviewLimit?: number;
  studyDate: string;
};

export function buildSession({
  cards,
  wordOrder,
  now,
  newLimit,
  reviewLimit = Infinity,
  studyDate,
}: BuildInput): SessionState {
  const due = cards.filter(
    (c) => !c.suspended && c.availableAt <= now && c.due <= now,
  );
  const easy = due
    .filter((c) => c.fsrs.state === State.Review)
    .sort((a, b) => b.fsrs.stability - a.fsrs.stability)
    .slice(0, WARMUP);
  const warmIds = new Set(easy.map((c) => c.id));
  const rest = due
    .filter((c) => !warmIds.has(c.id))
    .sort((a, b) => a.due - b.due)
    .slice(0, Math.max(0, reviewLimit - easy.length));

  const known = new Set(
    cards.filter((c) => c.kind === "listen").map((c) => c.itemId),
  );
  const fresh = wordOrder
    .filter((id) => !known.has(id))
    .slice(0, Math.max(0, newLimit));
  const newTasks: Task[] = [];
  for (let i = 0; i < fresh.length; i += NEW_BATCH) {
    const batch = fresh.slice(i, i + NEW_BATCH);
    newTasks.push(
      ...batch.map((itemId) => ({ type: "intro" as const, itemId })),
    );
    newTasks.push(
      ...batch.map((itemId) => ({ type: "listen-choice" as const, itemId })),
    );
  }

  return {
    studyDate,
    startedAt: now,
    queue: [
      ...easy.map(taskForCard),
      ...interleave(rest.map(taskForCard)),
      ...newTasks,
    ],
    pending: [],
    lastItemId: null,
    answered: 0,
    correct: 0,
    introduced: [],
  };
}

/** Следующее задание (state меняется). null — сессия закончена. */
export function nextTask(s: SessionState, now: number): Task | null {
  s.pending.sort((a, b) => a.dueAt - b.dueAt);
  const ready = s.pending.findIndex(
    (p) => p.dueAt <= now && p.task.itemId !== s.lastItemId,
  );
  // Новое слово после знакомства проверяем сразу — шаги изучения его не обгоняют.
  const head = s.queue[0];
  const keepNewTogether =
    head &&
    (head.type === "intro" ||
      (head.type === "listen-choice" &&
        s.introduced.includes(head.itemId) &&
        !s.pending.some((p) => p.task.itemId === head.itemId)));
  let task: Task | undefined;
  if (ready >= 0 && !keepNewTogether)
    task = s.pending.splice(ready, 1)[0]!.task;
  else if (s.queue.length) task = s.queue.shift();
  else if (s.pending.length) task = s.pending.shift()!.task; // конец сессии: оставшиеся шаги — сейчас
  if (!task) return null;
  s.lastItemId = task.itemId;
  return task;
}

/** Учесть ответ: если карточка ещё на шагах изучения и повтор скоро — вернуть её в сессию. */
export function afterAnswer(
  s: SessionState,
  task: Task,
  updated: CardRow | null,
  correct: boolean | null,
  now: number,
): void {
  if (["lesson", "reader"].includes(task.type)) return;
  if (task.type === "intro") {
    if (!s.introduced.includes(task.itemId)) s.introduced.push(task.itemId);
    return;
  }
  s.answered++;
  if (correct) s.correct++;
  if (!updated) return;
  const inSteps = updated.fsrs.state !== State.Review;
  if (inSteps && updated.due - now <= SESSION_HORIZON_MS) {
    const family = (t: Task) =>
      t.type.startsWith("listen-") ? "listen" : t.type;
    s.pending = s.pending.filter(
      (p) =>
        p.task.itemId !== updated.itemId || family(p.task) !== family(task),
    );
    s.pending.push({ task: taskForCard(updated), dueAt: updated.due });
  }
}

export function remaining(s: SessionState): number {
  return s.queue.length + s.pending.length;
}
