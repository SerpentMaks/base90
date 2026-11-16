import { useState, useRef, useEffect } from "react";
import type { Drill } from "../../content/course";
import { checkTyped, normalizeAnswer } from "../../lib/answer";
import { gradeAuto, type AutoResult } from "../../lib/fsrs";
import { say, stopSpeech } from "../../lib/speech";
import { SpeakButton } from "../../ui/SpeakButton";
import {
  btnPrimary,
  btnSecondary,
  Verdict,
  type ExerciseResult,
} from "../exercises/common";

export function DrillExercise({
  drill: d,
  onDone,
}: {
  drill: Drill;
  onDone: (r: ExerciseResult) => void;
}) {
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [result, setResult] = useState<AutoResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(Date.now());
  const answered = useRef(false);
  const tiles = useState(() =>
    d.en
      .replace(/[.!?]$/, "")
      .split(" ")
      .map((text, index) => ({ text, index }))
      .sort((a, b) => ((a.index * 17 + 11) % 23) - ((b.index * 17 + 11) % 23)),
  )[0];
  const choices = useState(
    () => d.choices?.slice().sort(() => Math.random() - 0.5) ?? [],
  )[0];
  const audio = d.audio ?? d.en;
  const heard =
    d.mode === "dictation" || d.mode === "choice" || d.kind === "cloze";
  useEffect(() => () => stopSpeech(), []);
  function check(value: string) {
    if (answered.current) return;
    answered.current = true;
    const r = checkTyped(value, [d.answer]);
    setResult(r.result);
    setElapsed(Date.now() - started.current);
    if (d.mode !== "choice") void say(d.en).catch(() => {});
  }
  return (
    <div className="flex flex-1 flex-col gap-5">
      <p className="text-sm text-muted">
        {d.mode === "dictation"
          ? "Аудирование"
          : d.mode === "tiles"
            ? "Собери предложение"
            : d.mode === "choice"
              ? "На слух"
              : "Заполни пропуск"}
      </p>
      {heard ? (
        <>
          <p className="text-xl">
            {d.mode === "choice" &&
            d.kind === "pair" &&
            d.prompt.startsWith("Что прозвучало?")
              ? "Какое слово прозвучало?"
              : d.prompt}
          </p>
          <SpeakButton text={audio} />
          <p className="text-xs text-muted">
            Нажми на динамик. Долгое нажатие — медленнее.
          </p>
        </>
      ) : (
        <>
          <p className="text-2xl font-semibold">{d.prompt}</p>
          {d.mode !== "tiles" && <p className="text-muted">{d.ru}</p>}
        </>
      )}
      {d.mode === "choice" ? (
        <div className="grid grid-cols-2 gap-3">
          {choices.map((c) => (
            <button
              disabled={!!result}
              className={btnSecondary}
              key={c}
              onClick={() => check(c)}
            >
              {c}
            </button>
          ))}
        </div>
      ) : d.mode === "tiles" ? (
        <>
          <div className="min-h-20 rounded-xl border border-line p-3 flex flex-wrap gap-2">
            {selected.map((n, i) => (
              <button
                key={i}
                className="rounded-lg bg-accent-soft px-3 py-2"
                disabled={!!result}
                onClick={() => setSelected(selected.filter((_, j) => j !== i))}
              >
                {tiles[n]!.text}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {tiles.map((t, i) => (
              <button
                key={t.index}
                disabled={!!result || selected.includes(i)}
                className="min-h-12 rounded-xl border border-line px-3 disabled:opacity-30"
                onClick={() => setSelected([...selected, i])}
              >
                {t.text}
              </button>
            ))}
          </div>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            check(input);
          }}
        >
          <label className="block text-sm">
            Твой ответ
            <input
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              lang="en"
              inputMode="text"
              value={input}
              disabled={!!result}
              onChange={(e) => setInput(e.target.value)}
              className="mt-2 w-full min-h-14 rounded-xl border border-line bg-surface p-3 text-xl"
            />
          </label>
        </form>
      )}
      {result && (
        <Verdict
          kind={
            result === "correct"
              ? "good"
              : result === "almost"
                ? "almost"
                : "bad"
          }
        >
          <b>
            {result === "correct"
              ? "Верно!"
              : result === "almost"
                ? "Почти!"
                : "Запомним на следующий раз"}
          </b>
          <p className="mt-2">{d.en}</p>
          <p className="text-sm mt-1">{d.ru}</p>
          {d.mode === "dictation" && (
            <div className="mt-2 flex flex-wrap gap-1">
              {d.en.split(" ").map((w, i) => (
                <span
                  key={i}
                  className={
                    normalizeAnswer(input).split(" ")[i] === normalizeAnswer(w)
                      ? "text-good"
                      : "text-bad underline"
                  }
                >
                  {w}
                </span>
              ))}
            </div>
          )}
          {d.mode === "choice" && (
            <p className="mt-2 text-sm">
              {d.prompt.replace("Что прозвучало? ", "")}
            </p>
          )}
        </Verdict>
      )}
      <div className="mt-auto flex flex-col gap-3 pt-4">
        {result ? (
          <button
            className={btnPrimary}
            onClick={() =>
              onDone({
                grade: gradeAuto(result, {
                  elapsedMs: elapsed,
                  slowMs: d.mode === "dictation" ? 30000 : 15000,
                }),
                correct: result !== "wrong",
                elapsedMs: elapsed,
              })
            }
          >
            Дальше
          </button>
        ) : (
          <>
            {d.mode !== "choice" && (
              <button
                className={btnPrimary}
                onClick={() =>
                  check(
                    d.mode === "tiles"
                      ? selected.map((n) => tiles[n]!.text).join(" ")
                      : input,
                  )
                }
              >
                Проверить
              </button>
            )}
            <button className={btnSecondary} onClick={() => check("")}>
              Не помню
            </button>
          </>
        )}
      </div>
    </div>
  );
}
