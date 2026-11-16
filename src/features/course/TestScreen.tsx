import { useState } from "react";
import { WORDS } from "../../content";
import { LESSONS, READINGS } from "../../content/course";
import { db } from "../../db/db";
import { Page } from "../../ui/Page";
import { DrillExercise } from "./DrillExercise";
import type { Drill } from "../../content/course";
export function TestScreen({ day }: { day: number }) {
  const [index, setIndex] = useState(0),
    [score, setScore] = useState(0);
  const tasks = useState<Drill[]>(() => {
    const grammarPool = LESSONS.filter(
      (l) => l.week <= Math.ceil(day / 7),
    ).flatMap((l) => l.drills);
    const grammar = Array.from(
      { length: 10 },
      (_, i) => grammarPool[Math.floor((i * (grammarPool.length - 1)) / 9)]!,
    );
    const words = WORDS.filter((w) => !w.tags?.includes("chunk"))
      .slice(0, Math.round(day * 8))
      .filter((_, i) => i % 19 === 0)
      .slice(0, 10)
      .map((w) => ({
        id: `test:${w.id}`,
        kind: "dictation" as const,
        mode: "dictation" as const,
        prompt: "Послушай и напечатай слово.",
        en: w.lemma,
        ru: w.ru.join("; "),
        answer: w.lemma,
        week: 1,
      }));
    const dialogue =
      READINGS.filter((r) => r.type === "dialogue")[
        [28, 56, 90].indexOf(day) * 20
      ] ?? READINGS.find((r) => r.type === "dialogue")!;
    const understanding = dialogue.questions.map((q, i) => ({
      id: `test:dialogue:${i}`,
      kind: "dictation" as const,
      mode: "choice" as const,
      prompt: q.prompt,
      en: dialogue.sentences.map((s) => s.en).join(" "),
      audio: dialogue.sentences.map((s) => s.en).join(" "),
      ru: q.answer,
      answer: q.answer,
      choices: q.choices,
      week: 1,
    }));
    const dictation = WORDS.filter((w) => !w.tags?.includes("chunk"))
      .slice(0, Math.round(day * 8))
      .filter((_, i) => i % 43 === 0)
      .slice(0, 3)
      .map((w) => ({
        id: `test:sentence:${w.id}`,
        kind: "dictation" as const,
        mode: "dictation" as const,
        prompt: "Послушай и напечатай предложение.",
        en: w.examples[0]!.en,
        ru: w.examples[0]!.ru,
        answer: w.examples[0]!.en,
        week: 1,
      }));
    return [...words, ...grammar, ...dictation, ...understanding];
  })[0];
  const current = tasks[index];
  return (
    <Page title={`Тест · день ${day}`}>
      {current ? (
        <>
          <p className="text-sm text-muted">
            {index + 1} / {tasks.length} · Не влияет на расписание повторений.
          </p>
          <DrillExercise
            key={current.id}
            drill={current}
            onDone={(r) => {
              const correct = score + (r.correct ? 1 : 0);
              setScore(correct);
              setIndex((n) => n + 1);
              if (index + 1 === tasks.length)
                void db.progress.put({
                  key: `test:${day}:${Date.now()}`,
                  value: { correct, total: tasks.length, at: Date.now() },
                  updatedAt: Date.now(),
                });
            }}
          />
        </>
      ) : (
        <>
          <h2 className="text-3xl font-bold">
            {score} / {tasks.length}
          </h2>
          <p>
            Результат сохранён. Сравни его с прошлой попыткой в разделе
            «Прогресс». Ошибки подскажут, к каким урокам вернуться.
          </p>
          <a href="#/stats" className="text-accent min-h-12">
            Посмотреть прогресс
          </a>
        </>
      )}
    </Page>
  );
}
