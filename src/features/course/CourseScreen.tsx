import type { WordItem } from "../../content/schema";
import { useEffect, useState, useRef } from "react";
import {
  LESSONS,
  IRREGULARS,
  PHRASALS,
  SOUNDS,
  READINGS,
  drillById,
  type Drill,
} from "../../content/course";
import { WORDS } from "../../content";
import { db } from "../../db/db";
import { repo } from "../../db/repo";
import { dailyPlan } from "../../lib/study";
import { navigate } from "../../lib/nav";
import { unlockAudio } from "../../lib/audio";
import { Page, panel } from "../../ui/Page";
import { SpeakButton } from "../../ui/SpeakButton";
import { DrillExercise } from "./DrillExercise";
import { Shadowing } from "./Shadowing";
import { btnPrimary, type ExerciseResult } from "../exercises/common";
import { studyDate } from "../../lib/time";
import { syncNow } from "../../lib/sync";
export function CourseScreen() {
  const [week, setWeek] = useState(1),
    [known, setKnown] = useState(new Set<string>()),
    [done, setDone] = useState(new Set<string>());
  useEffect(() => {
    void dailyPlan().then((p) => setWeek(Math.ceil(p.studyDay / 7)));
    void repo()
      .allCards()
      .then((c) =>
        setKnown(
          new Set(c.filter((x) => x.kind === "listen").map((x) => x.itemId)),
        ),
      );
    void db.progress
      .toArray()
      .then((rows) => setDone(new Set(rows.map((r) => r.key))));
  }, []);
  return (
    <Page title="Уроки">
      <h2 className="font-semibold">Грамматика · неделя {week}</h2>
      {LESSONS.map((l) => (
        <a key={l.id} className={panel} href={`#/lesson/${l.id}`}>
          <b>
            {done.has("lesson:" + l.id) ? "✓ " : ""}
            {l.week}. {l.title}
          </b>
          <p className="text-sm text-muted">
            {l.week > week
              ? "Впереди по плану · можно посмотреть заранее"
              : `${l.drills.length} коротких упражнений`}
          </p>
        </a>
      ))}
      <h2 className="text-xl font-bold mt-3">Звуки и аудирование</h2>
      <p className="text-sm text-muted">
        В первые три дня начни здесь: /w/–/v/, межзубные звуки, короткие и
        долгие гласные.
      </p>
      <details className={panel}><summary className="font-semibold min-h-12 flex items-center">Как произносить эти звуки</summary><div className="text-sm leading-relaxed flex flex-col gap-2"><p>/w/: округли губы, зубы не касаются губы. /v/: верхние зубы касаются нижней губы.</p><p>/θ/ и /ð/: кончик языка слегка между зубами; /ð/ звучит с голосом. Не заменяй их русскими «с» и «з».</p><p>Ship и sheep различаются качеством гласной, а не только длиной: /ɪ/ расслабленнее, /iː/ напряжённее. Для /æ/ в bad открой рот шире, чем для /e/ в bed.</p><p>В потоке речи служебные слова ослабляются: can /kən/, to /tə/, and /ən/, of /əv/. Слушай целую фразу, затем сравни запись с полной формой.</p><p>Окончание -s: /s/ после глухого звука, /z/ после звонкого, /ɪz/ после шипящих. -ed: /t/ после глухого, /d/ после звонкого, /ɪd/ после /t/ и /d/.</p></div></details>
      <a className={panel} href="#/practice/sounds">
        Звуки, минимальные пары и числа ·{" "}
        {SOUNDS.filter((d) => d.kind === "pair").length} заданий
      </a>
      <a className={panel} href="#/practice/speech">
        Связная речь и окончания
      </a>
      <a className={panel} href="#/practice/cloze">
        Слово в контексте
      </a>
      <a className={panel} href="#/practice/dictation">
        Диктант
      </a>
      <a className={panel} href="#/practice/shadow">
        Повтори за голосом
      </a>
      <h2 className="text-xl font-bold mt-3">Истории и диалоги</h2>
      {READINGS.map((r) => {
        const unlocked = WORDS.filter(
          (w) => w.rank <= r.unlockRank && !w.tags?.includes("chunk"),
        ).every((w) => known.has(w.id));
        return (
          <a className={panel} key={r.id} href={`#/reader/${r.id}`}>
            <b>
              {done.has("reading:" + r.id) ? "✓ " : ""}
              {r.title}
            </b>
            <p className="text-sm text-muted">
              {r.type === "story" ? "История" : "Диалог"} ·{" "}
              {unlocked
                ? "Словарь уже знаком"
                : `Ориентир: ${r.unlockRank} элементов`}{" "}
              · {Math.round(r.coverageAtUnlock * 100)}% покрытия
            </p>
          </a>
        );
      })}
    </Page>
  );
}
export function LessonScreen({ id }: { id: string }) {
  const l = LESSONS.find((x) => x.id === id);
  if (!l) return <Page title="Урок не найден" />;
  return (
    <Page title={`Неделя ${l.week}`}>
      <h2 className="text-2xl font-bold">{l.title}</h2>
      <p className="leading-relaxed">{l.explanation}</p>
      {l.examples.map((e) => (
        <div key={e.en} className={panel}>
          <SpeakButton text={e.en} />
          <p className="mt-2 font-medium">{e.en}</p>
          <p className="text-sm text-muted">{e.ru}</p>
        </div>
      ))}
      {l.week === 8 && (
        <section className={panel}>
          <h3 className="font-semibold">30 частых неправильных глаголов</h3>
          <p className="text-sm text-muted my-2">
            Начальная → прошедшая → третья форма. Учи по 3–5 за раз. Read в
            настоящем /riːd/, в прошлом /red/. Для американского английского:
            get — got — gotten.
          </p>
          {IRREGULARS.map(([base, past, part, ru]) => (
            <p className="text-sm py-2 border-b border-line" key={base}>
              {base} → {past} → {part}
              <br />
              <span className="text-muted">{ru}</span>
            </p>
          ))}
        </section>
      )}
      {l.week === 13 && (
        <section className={panel}>
          <h3 className="font-semibold">30 фразовых глаголов</h3>
          {PHRASALS.map(([phrase, meaning, en, ru]) => (
            <div className="py-3 border-b border-line" key={phrase}>
              <b>{phrase}</b> — {meaning}
              <div className="flex items-center gap-2">
                <SpeakButton text={en!} />
                <p className="text-sm">
                  {en}
                  <br />
                  {ru}
                </p>
              </div>
            </div>
          ))}
        </section>
      )}
      <button
        className={btnPrimary}
        onClick={() => {
          unlockAudio();
          navigate("#/practice/" + id);
        }}
      >
        Практика · {l.drills.length} заданий
      </button>
    </Page>
  );
}
export function PracticeScreen({ id }: { id: string }) {
  const l = LESSONS.find((l) => l.id === id);
  const [index, setIndex] = useState(0),
    [error, setError] = useState("");
  const tasks = useState<Drill[]>(
    () =>
      l?.drills ??
      (id === "sounds"
        ? SOUNDS.filter((d) => d.kind === "pair")
        : id === "speech"
          ? SOUNDS.filter((d) => d.kind === "speech")
          : id === "cloze"
            ? WORDS.map(makeCloze)
                .filter((d): d is Drill => d !== null)
                .slice(0, 12)
            : WORDS.filter((w) => w.examples[0])
                .slice(0, 12)
                .map((w) => ({
                  id: `dict_${w.id}`,
                  kind: "dictation",
                  mode: "dictation",
                  en: w.examples[0]!.en,
                  ru: w.examples[0]!.ru,
                  prompt: "Послушай и напечатай предложение.",
                  answer: w.examples[0]!.en,
                  week: 1,
                }))),
  )[0];
  const [ready, setReady] = useState(false);
  const saving = useRef(false);
  useEffect(() => {
    let alive = true;
    void db.progress.get("private:practice:" + id).then((row) => {
      const value = (row?.value as { index: number } | undefined)?.index ?? 0;
      if (alive) {
        setIndex(value < tasks.length || id === "shadow" ? value : 0);
        setReady(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [id, tasks]);
  const current = tasks[index];
  async function done(r: ExerciseResult) {
    if (!current || r.grade === null || saving.current) return;
    saving.current = true;
    try {
      const c = await repo().ensureCard(current.kind, current.id);
      await repo().answer(c, r.grade, {
        elapsedMs: r.elapsedMs,
        exerciseType: current.mode,
      });
      await db.progress.put({
        key: "private:practice:" + id,
        value: { index: index + 1 },
        updatedAt: Date.now(),
      });
      setIndex((i) => i + 1);
      if (index + 1 >= tasks.length) {
        await db.progress.delete("private:practice:" + id);
        await db.progress.put({
          key: l ? "lesson:" + l.id : "practice:" + id,
          value: true,
          updatedAt: Date.now(),
        });
        await db.progress.put({
          key: `practice:${id}:${studyDate()}`,
          value: true,
          updatedAt: Date.now(),
        });
        void syncNow().catch(() => {});
      }
    } catch {
      setError("Не удалось сохранить ответ. Попробуй ещё раз.");
    } finally {
      saving.current = false;
    }
  }
  if (!ready) return <Page title="Загрузка…" />;
  if (id === "shadow")
    return (
      <Page title="Произношение">
        {error && <p role="alert">{error}</p>}
        <Shadowing
          key={index}
          en={WORDS[index % WORDS.length]!.examples[0]!.en}
          ru={WORDS[index % WORDS.length]!.examples[0]!.ru}
          onDone={(grade) => {
            if (saving.current) return;
            saving.current = true;
            void (async () => {
              const w = WORDS[index % WORDS.length]!;
              const c = await repo().ensureCard("shadow", w.id);
              await repo().answer(c, grade, {
                elapsedMs: 0,
                exerciseType: "shadow",
              });
              await db.progress.put({
                key: "private:practice:" + id,
                value: { index: index + 1 },
                updatedAt: Date.now(),
              });
              setIndex((i) => i + 1);
            })()
              .catch(() => setError("Не удалось сохранить ответ."))
              .finally(() => {
                saving.current = false;
              });
          }}
        />
      </Page>
    );
  return (
    <Page title={l?.title ?? "Практика"}>
      {error && <p role="alert">{error}</p>}
      {current ? (
        <>
          <p className="text-sm text-muted">
            {index + 1} / {tasks.length}
          </p>
          <DrillExercise
            key={current.id}
            drill={current}
            onDone={(r) => void done(r)}
          />
        </>
      ) : (
        <>
          <h2 className="text-2xl font-bold">Практика завершена ✓</h2>
          <p>Эти задания будут возвращаться в повторениях.</p>
          <a
            className={btnPrimary + " grid place-items-center"}
            href="#/course"
          >
            К урокам
          </a>
        </>
      )}
    </Page>
  );
}
export function resolveDrill(id: string): Drill | undefined {
  const found = drillById.get(id);
  if (found) return found;
  if (id.startsWith("cloze_")) {
    const w = WORDS.find((w) => `cloze_${w.id}` === id);
    return w ? (makeCloze(w) ?? undefined) : undefined;
  }
  if (id.startsWith("dict_")) {
    const w = WORDS.find((w) => `dict_${w.id}` === id);
    if (w)
      return {
        id,
        kind: "dictation",
        mode: "dictation",
        prompt: "Послушай и напечатай предложение.",
        en: w.examples[0]!.en,
        ru: w.examples[0]!.ru,
        answer: w.examples[0]!.en,
        week: 1,
      };
  }
  return undefined;
}

function makeCloze(w: WordItem): Drill | null {
  if (w.tags?.includes("chunk")) return null;
  const forms = new Set(
    [w.lemma, ...(w.forms ?? [])].map((s) => s.toLowerCase()),
  );
  for (const e of w.examples) {
    const token = e.en
      .match(/\b[a-zA-Z']+\b/g)
      ?.find((t) => forms.has(t.toLowerCase()));
    if (token) {
      const i = e.en.indexOf(token);
      return {
        id: `cloze_${w.id}`,
        kind: "cloze",
        mode: "form",
        en: e.en,
        ru: e.ru,
        prompt: e.en.slice(0, i) + "___" + e.en.slice(i + token.length),
        answer: token,
        week: 1,
      };
    }
  }
  return null;
}
