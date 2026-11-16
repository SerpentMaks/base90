import { describe, expect, it } from "vitest";
import type { CardRow } from "../db/db";
import { State } from "./fsrs";
import {
  afterAnswer,
  buildSession,
  interleave,
  nextTask,
  type Task,
} from "./session";

const NOW = Date.parse("2026-11-17T07:00:00Z");
const MIN = 60_000;

function card(
  itemId: string,
  kind: "listen" | "produce",
  state: number,
  dueOffsetMin: number,
  stability = 5,
): CardRow {
  return {
    id: `${kind}:${itemId}`,
    itemId,
    kind,
    fsrs: { state, stability } as CardRow["fsrs"],
    due: NOW + dueOffsetMin * MIN,
    availableAt: 0,
    createdAt: 0,
    updatedAt: 0,
  };
}

const order = ["a", "b", "c", "d", "e", "f", "g"];

describe("buildSession", () => {
  it("сначала повторения, потом новые слова пачками: 3 знакомства → 3 проверки", () => {
    const s = buildSession({
      cards: [card("x", "listen", State.Review, -60)],
      wordOrder: order,
      now: NOW,
      newLimit: 5,
      studyDate: "2026-11-17",
    });
    expect(s.queue.map((t) => `${t.type}:${t.itemId}`)).toEqual([
      "listen-self:x",
      "intro:a",
      "intro:b",
      "intro:c",
      "listen-choice:a",
      "listen-choice:b",
      "listen-choice:c",
      "intro:d",
      "intro:e",
      "listen-choice:d",
      "listen-choice:e",
    ]);
  });

  it("разминка — самые лёгкие (высокая стабильность) повторения первыми", () => {
    const cards = [
      card("hard", "listen", State.Review, -100, 1),
      card("easy1", "listen", State.Review, -10, 50),
      card("easy2", "listen", State.Review, -10, 40),
    ];
    const s = buildSession({
      cards,
      wordOrder: [],
      now: NOW,
      newLimit: 0,
      studyDate: "d",
    });
    expect(s.queue.map((t) => t.itemId)).toEqual(["easy1", "easy2", "hard"]);
  });

  it("не берёт будущие, приостановленные и ещё недоступные карточки; не повторяет выученные слова как новые", () => {
    const future = card("f", "listen", State.Review, +60);
    const suspended = {
      ...card("s", "listen", State.Review, -5),
      suspended: 1 as const,
    };
    const locked = {
      ...card("l", "produce", State.New, -5),
      availableAt: NOW + 3600_000,
    };
    const s = buildSession({
      cards: [future, suspended, locked],
      wordOrder: ["f", "s", "n"],
      now: NOW,
      newLimit: 5,
      studyDate: "d",
    });
    expect(s.queue.map((t) => `${t.type}:${t.itemId}`)).toEqual([
      "intro:n",
      "listen-choice:n",
    ]);
  });

  it("новые карточки на шагах — выбор из 4, на повторении — самооценка, produce — ввод", () => {
    const s = buildSession({
      cards: [
        card("l", "listen", State.Learning, -1),
        card("r", "listen", State.Review, -1, 0.1),
        card("p", "produce", State.New, -1),
      ],
      wordOrder: [],
      now: NOW,
      newLimit: 0,
      studyDate: "d",
    });
    const types = Object.fromEntries(s.queue.map((t) => [t.itemId, t.type]));
    expect(types).toEqual({
      l: "listen-choice",
      r: "listen-self",
      p: "produce",
    });
  });
});

describe("interleave", () => {
  it("не больше 5 заданий одного типа подряд", () => {
    const tasks: Task[] = [
      ...Array.from({ length: 8 }, (_, i) => ({
        type: "listen-self" as const,
        itemId: `l${i}`,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        type: "produce" as const,
        itemId: `p${i}`,
      })),
    ];
    const out = interleave(tasks);
    let run = 1;
    for (let i = 1; i < out.length; i++) {
      run = out[i]!.type === out[i - 1]!.type ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(5);
    }
    expect(out).toHaveLength(11);
  });
});

describe("nextTask / afterAnswer — шаги изучения внутри сессии", () => {
  it("ошибка → слово вернётся через минуту, но не сразу следующим", () => {
    const s = buildSession({
      cards: [],
      wordOrder: ["a", "b"],
      now: NOW,
      newLimit: 2,
      studyDate: "d",
    });
    expect(nextTask(s, NOW)).toEqual({ type: "intro", itemId: "a" });
    afterAnswer(s, { type: "intro", itemId: "a" }, null, null, NOW);
    expect(nextTask(s, NOW)).toEqual({ type: "intro", itemId: "b" });
    afterAnswer(s, { type: "intro", itemId: "b" }, null, null, NOW);
    const check = nextTask(s, NOW)!;
    expect(check).toEqual({ type: "listen-choice", itemId: "a" });
    afterAnswer(s, check, card("a", "listen", State.Learning, +1), false, NOW);
    // через минуту «a» готово, но новое «b» проверяется сразу после знакомства
    expect(nextTask(s, NOW + 2 * MIN)).toEqual({
      type: "listen-choice",
      itemId: "b",
    });
    afterAnswer(
      s,
      { type: "listen-choice", itemId: "b" },
      card("b", "listen", State.Learning, +10),
      true,
      NOW + 2 * MIN,
    );
    expect(nextTask(s, NOW + 2 * MIN)).toEqual({
      type: "listen-choice",
      itemId: "a",
    });
  });

  it("очередь кончилась — оставшиеся шаги показываются в конце, не дожидаясь 10 минут", () => {
    const s = buildSession({
      cards: [],
      wordOrder: ["a"],
      now: NOW,
      newLimit: 1,
      studyDate: "d",
    });
    nextTask(s, NOW);
    afterAnswer(s, { type: "intro", itemId: "a" }, null, null, NOW);
    const t = nextTask(s, NOW)!;
    afterAnswer(s, t, card("a", "listen", State.Learning, +10), true, NOW);
    expect(nextTask(s, NOW + MIN)).toEqual({
      type: "listen-choice",
      itemId: "a",
    });
    afterAnswer(
      s,
      t,
      card("a", "listen", State.Review, +2 * 24 * 60),
      true,
      NOW + MIN,
    );
    expect(nextTask(s, NOW + MIN)).toBeNull();
    expect(s.answered).toBe(2);
    expect(s.correct).toBe(2);
  });

  it("карточка с повтором через дни в сессию не возвращается", () => {
    const s = buildSession({
      cards: [card("x", "listen", State.Review, -1)],
      wordOrder: [],
      now: NOW,
      newLimit: 0,
      studyDate: "d",
    });
    const t = nextTask(s, NOW)!;
    afterAnswer(
      s,
      t,
      card("x", "listen", State.Review, +3 * 24 * 60),
      true,
      NOW,
    );
    expect(nextTask(s, NOW)).toBeNull();
  });
});

it("повтор воспроизведения не удаляет шаг узнавания того же слова", () => {
  const state = buildSession({
    cards: [],
    wordOrder: [],
    newLimit: 0,
    now: 0,
    studyDate: "2026-11-17",
  });
  state.pending = [
    { task: { type: "listen-choice", itemId: "w_same" }, dueAt: 1000 },
  ];
  const updated = {
    id: "produce:w_same",
    itemId: "w_same",
    kind: "produce",
    fsrs: { state: 1 },
    due: 1000,
  } as import("../db/db").CardRow;
  afterAnswer(state, { type: "produce", itemId: "w_same" }, updated, true, 0);
  expect(state.pending.map((p) => p.task.type)).toEqual([
    "listen-choice",
    "produce",
  ]);
});
