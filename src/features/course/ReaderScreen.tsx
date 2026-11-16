import { stopSpeech } from "../../lib/speech";
import { useEffect, useState } from "react";
import { READINGS } from "../../content/course";
import { WORDS } from "../../content";
import forms from "../../content/forms.json";
import { Lemmatizer } from "../../lib/lemmatize";
import { db } from "../../db/db";
import { repo } from "../../db/repo";
import { Page, panel } from "../../ui/Page";
import { SpeakButton } from "../../ui/SpeakButton";
import { btnPrimary, btnSecondary } from "../exercises/common";
const L = new Lemmatizer(forms);
export function ReaderScreen({
  id,
  onComplete,
}: {
  id: string;
  onComplete?: () => void;
}) {
  const r = READINGS.find((x) => x.id === id);
  const [index, setIndex] = useState(0),
    [revealed, setRevealed] = useState(false),
    [translation, setTranslation] = useState(false),
    [picked, setPicked] = useState(""),
    [selected, setSelected] = useState(""),
    [correct, setCorrect] = useState(0),
    [loaded, setLoaded] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => () => stopSpeech(), [index]);
  useEffect(() => {
    void db.progress.get("reader-position:" + id).then((row) => {
      const position = row?.value as
        { index: number; correct?: number } | undefined;
      setIndex(position?.index ?? 0);
      setCorrect(position?.correct ?? 0);
      setLoaded(true);
    });
  }, [id]);
  if (!r) return <Page title="Текст не найден" />;
  if (!loaded) return <Page title="Загрузка…" />;
  const sentence = r.sentences[index];
  const question = r.questions[index - r.sentences.length];
  const rawToken = selected.toLowerCase().replace(/[^a-z']/g, "");
  const w =
    WORDS.find((w) => w.lemma.toLowerCase() === rawToken) ??
    WORDS.find(
      (w) => w.lemma.toLowerCase() === (L.lemmatize(rawToken)[0] ?? rawToken),
    );
  async function next() {
    const next = index + 1;
    await db.progress.put({
      key: "reader-position:" + id,
      value: { index: next, correct },
      updatedAt: Date.now(),
    });
    setIndex(next);
    setRevealed(false);
    setTranslation(false);
    setPicked("");
    setSelected("");
    if (next >= r!.sentences.length + r!.questions.length)
      await db.progress.put({
        key: "reading:" + id,
        value: {
          correct,
          total: r!.questions.length,
        },
        updatedAt: Date.now(),
      });
  }
  return (
    <Page title={r.title}>
      <p className="text-sm text-muted">
        {Math.min(index + 1, r.sentences.length + r.questions.length)} /{" "}
        {r.sentences.length + r.questions.length}
      </p>
      {sentence ? (
        <>
          <SpeakButton text={sentence.en} />
          <p className="text-muted">
            Сначала послушай. Попробуй понять без текста.
          </p>
          {revealed ? (
            <div className={panel}>
              <p className="text-xl leading-relaxed">
                {sentence.en.split(/(\s+)/).map((token, i) =>
                  /\w/.test(token) ? (
                    <button
                      className="rounded py-1 hover:bg-accent-soft"
                      onClick={() => {
                        setSelected(token);
                        setMessage("");
                      }}
                      key={i}
                    >
                      {token}
                    </button>
                  ) : (
                    token
                  ),
                )}
              </p>
              <button
                className="mt-3 text-accent min-h-12"
                onClick={() => setTranslation(!translation)}
              >
                Перевод
              </button>
              {translation && <p>{sentence.ru}</p>}
            </div>
          ) : (
            <button className={btnSecondary} onClick={() => setRevealed(true)}>
              Показать текст
            </button>
          )}
          {selected && (
            <div className={panel}>
              <b>{selected}</b>
              <p>
                {w ? w.ru.join("; ") : "Этого слова пока нет в словаре курса."}
              </p>
              {w && (
                <button
                  className="min-h-12 text-accent"
                  onClick={() =>
                    void repo()
                      .introduce(w.id)
                      .then(() => setMessage("Добавлено в повторения"))
                  }
                >
                  Добавить в повторения
                </button>
              )}
              {message && <p role="status">{message}</p>}
            </div>
          )}
          <button className={btnPrimary} onClick={() => void next()}>
            Следующая фраза
          </button>
        </>
      ) : question ? (
        <>
          <h2 className="text-xl font-semibold">{question.prompt}</h2>
          {question.choices
            .slice()
            .sort((a, b) => a.localeCompare(b))
            .map((c) => (
              <button
                key={c}
                className={btnSecondary}
                disabled={!!picked}
                onClick={() => {
                  setPicked(c);
                  if (c === question.answer) setCorrect((n) => n + 1);
                }}
              >
                {c}
              </button>
            ))}
          {picked && (
            <>
              <p
                role="status"
                className={
                  picked === question.answer ? "text-good" : "text-bad"
                }
              >
                {picked === question.answer
                  ? "Верно!"
                  : `Ответ: ${question.answer}`}
              </p>
              <button className={btnPrimary} onClick={() => void next()}>
                Дальше
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <h2 className="text-2xl font-bold">Текст пройден ✓</h2>
          {onComplete && (
            <button className={btnPrimary} onClick={onComplete}>
              Дальше
            </button>
          )}
          <p>
            Попробуй пересказать его своими словами. Даже две фразы — хорошая
            практика.
          </p>
          <button
            className={btnSecondary}
            onClick={() => {
              void db.progress
                .put({
                  key: "reader-position:" + id,
                  value: { index: 0, correct: 0 },
                  updatedAt: Date.now(),
                })
                .then(() => {
                  setIndex(0);
                  setCorrect(0);
                })
                .catch(() => setMessage("Не удалось сохранить позицию."));
            }}
          >
            Послушать ещё раз
          </button>
          <a
            href="#/course"
            className={btnPrimary + " grid place-items-center"}
          >
            К урокам
          </a>
        </>
      )}
    </Page>
  );
}
