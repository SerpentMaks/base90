import { getScheduler } from "../../lib/fsrs";
import { getSettings } from "../../lib/settings";
import { db } from "../../db/db";
import { WORDS, word } from "../../content";
import { LESSONS, SOUNDS, READINGS } from "../../content/course";
import { Shadowing } from "../course/Shadowing";
import { ReaderScreen } from "../course/ReaderScreen";
import { SpeakButton } from "../../ui/SpeakButton";
import { btnPrimary } from "../exercises/common";
import { dailyPlan } from "../../lib/study";
import { resolveDrill } from "../course/CourseScreen";
import { DrillExercise } from "../course/DrillExercise";
import { syncNow } from "../../lib/sync";
import { useEffect, useRef, useState } from "react";
import { WORD_ORDER } from "../../content";
import { repo } from "../../db/repo";
import {
  afterAnswer,
  buildSession,
  nextTask,
  remaining,
  type SessionState,
  type Task,
} from "../../lib/session";
import { stopSpeech } from "../../lib/speech";
import { studyDate } from "../../lib/time";
import { Intro } from "../exercises/Intro";
import { ListenChoice } from "../exercises/ListenChoice";
import { ListenSelf } from "../exercises/ListenSelf";
import { ProduceInput } from "../exercises/ProduceInput";
import type { ExerciseResult } from "../exercises/common";
import { Summary } from "./Summary";

/** Сколько новых слов за один заход (этап 2; на этапе 4 это посчитает дневной план). */
export const NEW_PER_SESSION = 5;

/** Начать новую сессию или продолжить сохранённую (если она сегодняшняя и не закончена). */
async function openSession(fresh: boolean): Promise<SessionState> {
  const today = studyDate();
  const saved = fresh ? null : await repo().loadSession();
  if (saved && saved.studyDate === today && remaining(saved) > 0) return saved;
  const cards = await repo().allCards();
  const plan = await dailyPlan();
  const s = buildSession({
    cards,
    wordOrder: WORD_ORDER,
    now: Date.now(),
    newLimit: Math.min(NEW_PER_SESSION, plan.newLeft),
    reviewLimit: 30,
    studyDate: today,
  });
  const progress = new Set((await db.progress.toArray()).map((r) => r.key));
  const lesson = LESSONS.find(
    (l) =>
      l.week <= Math.ceil(plan.studyDay / 7) && !progress.has("lesson:" + l.id),
  );
  if (lesson) {
    s.queue.push(
      { type: "lesson", itemId: lesson.id },
      ...lesson.drills.map((d) => ({ type: "drill" as const, itemId: d.id })),
    );
  }
  const soundTasks: Task[] = [];
  if (!progress.has(`practice:sounds:${today}`)) {
    const pairs = SOUNDS.filter((d) => d.kind === "pair");
    const offset = ((plan.studyDay - 1) * 12) % pairs.length;
    soundTasks.push(
      ...Array.from({ length: plan.studyDay <= 3 ? 12 : 4 }, (_, i) => ({
        type: "drill" as const,
        itemId: pairs[(offset + i) % pairs.length]!.id,
      })),
    );
  }
  const learned = new Set(
    cards.filter((c) => c.kind === "listen").map((c) => c.itemId),
  );
  const activeWords = new Set(
    cards
      .filter((c) => c.kind === "listen" && !c.suspended)
      .map((c) => c.itemId),
  );
  const candidates = WORDS.filter((w) => activeWords.has(w.id));
  const day = await repo().getDay(today);
  const contextWord =
    candidates[
      (plan.studyDay * 17 + (day?.reviewsDone ?? 0)) %
        Math.max(1, candidates.length)
    ] ?? WORDS[0]!;
  // Короткие фонетические блоки разделяем диктантом и повторением вслух.
  s.queue.push(
    ...soundTasks.slice(0, 4),
    { type: "drill", itemId: `dict_${contextWord.id}` },
    ...soundTasks.slice(4, 8),
    { type: "shadow", itemId: contextWord.id },
    ...soundTasks.slice(8),
  );
  if (plan.studyDay >= 29) {
    const story = READINGS.find(
      (r) =>
        !progress.has("reading:" + r.id) &&
        WORDS.filter(
          (w) => w.rank <= r.unlockRank && !w.tags?.includes("chunk"),
        ).every((w) => learned.has(w.id)),
    );
    if (story) s.queue.push({ type: "reader", itemId: story.id });
  }
  return s;
}

export function SessionScreen({
  fresh,
  onExit,
}: {
  fresh: boolean;
  onExit: () => void;
}) {
  const session = useRef<SessionState | null>(null);
  const [task, setTask] = useState<Task | null | "loading">("loading");
  const [step, setStep] = useState(0);
  const [total, setTotal] = useState(1);
  const busy = useRef(false);
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void openSession(fresh).then(async (s) => {
      if (!alive) return;
      session.current = s;
      // Перезагрузка (или iOS, восстановивший приложение) должна продолжить эту сессию, а не начать новую.
      if (window.location.hash !== "#/session")
        history.replaceState(null, "", "#/session");
      const t = nextTask(s, Date.now());
      setTotal(remaining(s) + (t ? 1 : 0) + s.answered + s.introduced.length);
      setStep(s.answered + s.introduced.length);
      setTask(t);
      await repo().saveSession(t ? { ...s, queue: [t, ...s.queue] } : null);
    });
    return () => {
      alive = false;
      stopSpeech();
    };
  }, [fresh]);

  async function handleDone(t: Task, r: ExerciseResult) {
    const current = session.current;
    if (!current || busy.current) return;
    const s = structuredClone(current);
    busy.current = true;
    setSaving(true);
    setError("");
    stopSpeech();
    try {
      await getScheduler(getSettings().retention);
      const next = await db.transaction(
        "rw",
        db.cards,
        db.days,
        db.reviewLogs,
        db.progress,
        async () => {
          const now = new Date();
          let updated = null;
          if (t.type === "intro") {
            await repo().introduce(t.itemId, now);
          } else if (t.type === "shadow" && r.grade !== null) {
            const card = await repo().ensureCard("shadow", t.itemId);
            updated = await repo().answer(card, r.grade, {
              now,
              elapsedMs: r.elapsedMs,
              exerciseType: "shadow",
            });
          } else if (r.grade !== null) {
            const card =
              t.type === "drill"
                ? await repo().ensureCard(
                    resolveDrill(t.itemId)?.kind ?? "grammar",
                    t.itemId,
                  )
                : await repo().getCard(
                    t.type === "produce" ? "produce" : "listen",
                    t.itemId,
                  );
            if (card)
              updated = await repo().answer(card, r.grade, {
                now,
                elapsedMs: r.elapsedMs,
                exerciseType: t.type,
              });
          }
          if (t.type === "drill") {
            const lesson = LESSONS.find(
              (l) => l.drills.at(-1)?.id === t.itemId,
            );
            if (lesson)
              await db.progress.put({
                key: "lesson:" + lesson.id,
                value: true,
                updatedAt: Date.now(),
              });
            if (
              resolveDrill(t.itemId)?.kind === "pair" &&
              !s.queue.some(
                (q) =>
                  q.type === "drill" && resolveDrill(q.itemId)?.kind === "pair",
              )
            )
              await db.progress.put({
                key: `practice:sounds:${s.studyDate}`,
                value: true,
                updatedAt: Date.now(),
              });
          }
          afterAnswer(s, t, updated, r.correct, now.getTime());
          const next = nextTask(s, Date.now());
          // Сохраняем вместе с текущим заданием в начале очереди — «Продолжить» вернёт сюда же.
          await repo().saveSession(
            next ? { ...s, queue: [next, ...s.queue] } : null,
          );
          return next;
        },
      );
      session.current = s;
      setStep((n) => n + 1);
      setTotal((n) => Math.max(n, step + 1 + remaining(s) + (next ? 1 : 0)));
      setTask(next);
      if (!next) void syncNow().catch(() => {});
    } catch {
      setError(
        "Ответ не сохранён. Попробуй нажать «Дальше» ещё раз: предыдущий ответ не изменён.",
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  if (task === "loading")
    return <div className="p-6 text-center text-muted">Загрузка…</div>;

  const progress = Math.min(1, step / Math.max(1, total));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-6">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-bg pt-3 pb-2">
        <button
          onClick={() => {
            stopSpeech();
            onExit();
          }}
          disabled={saving}
          aria-label="Пауза — прогресс сохранится"
          className="grid h-12 w-12 place-items-center rounded-full text-2xl text-muted"
        >
          ✕
        </button>
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </header>

      <div
        className="flex flex-1 flex-col pt-4"
        data-step={step}
        aria-busy={saving}
      >
        {error && (
          <p role="alert" className="rounded-xl bg-bad/10 text-bad p-3 mb-3">
            {error}
          </p>
        )}
        {task === null ? (
          <Summary session={session.current} onExit={onExit} />
        ) : (
          <Exercise
            key={`${step}:${task.type}:${task.itemId}`}
            task={task}
            onDone={(r) => void handleDone(task, r)}
          />
        )}
      </div>
    </main>
  );
}

function Exercise({
  task,
  onDone,
}: {
  task: Task;
  onDone: (r: ExerciseResult) => void;
}) {
  switch (task.type) {
    case "lesson": {
      const l = LESSONS.find((l) => l.id === task.itemId)!;
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">Короткий урок · неделя {l.week}</p>
          <h2 className="text-2xl font-bold">{l.title}</h2>
          <p className="leading-relaxed">{l.explanation}</p>
          {l.examples.slice(0, 3).map((e) => (
            <div
              className="flex gap-3 items-center rounded-xl bg-surface p-3"
              key={e.en}
            >
              <SpeakButton text={e.en} />
              <p>
                {e.en}
                <br />
                <span className="text-sm text-muted">{e.ru}</span>
              </p>
            </div>
          ))}
          <button
            className={btnPrimary}
            onClick={() => onDone({ grade: null, correct: null, elapsedMs: 0 })}
          >
            Попрактикуемся
          </button>
        </div>
      );
    }
    case "reader":
      return (
        <ReaderScreen
          id={task.itemId}
          onComplete={() =>
            onDone({ grade: null, correct: null, elapsedMs: 0 })
          }
        />
      );
    case "shadow": {
      const w = word(task.itemId);
      return (
        <Shadowing
          en={w.examples[0]!.en}
          ru={w.examples[0]!.ru}
          onDone={(grade) =>
            onDone({ grade, correct: grade > 1, elapsedMs: 0 })
          }
        />
      );
    }

    case "drill": {
      const d = resolveDrill(task.itemId);
      return d ? (
        <DrillExercise drill={d} onDone={onDone} />
      ) : (
        <button
          onClick={() => onDone({ grade: null, correct: null, elapsedMs: 0 })}
        >
          Пропустить недоступное задание
        </button>
      );
    }
    case "intro":
      return <Intro itemId={task.itemId} onDone={onDone} />;
    case "listen-choice":
      return <ListenChoice itemId={task.itemId} onDone={onDone} />;
    case "listen-self":
      return <ListenSelf itemId={task.itemId} onDone={onDone} />;
    case "produce":
      return <ProduceInput itemId={task.itemId} onDone={onDone} />;
  }
}
