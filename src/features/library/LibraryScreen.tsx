import { useEffect, useState } from "react";
import { WORDS } from "../../content";
import { repo } from "../../db/repo";
import type { CardRow } from "../../db/db";
import { Page, panel } from "../../ui/Page";
import { SpeakButton } from "../../ui/SpeakButton";
import { Rating, State } from "../../lib/fsrs";
export async function markKnown(id: string) {
  const c = await repo().introduce(id);
  const updated = await repo().answer(c, Rating.Good, {
    elapsedMs: 0,
    exerciseType: "placement",
  });
  const { db } = await import("../../db/db");
  const due = Date.now() + 3 * 86400000;
  await db.cards.put({
    ...updated,
    fsrs: {
      ...updated.fsrs,
      state: State.Review,
      scheduleStatus: "review",
      dueAt: new Date(due),
      stability: 3,
      learningStep: 0,
      scheduledDays: 3,
    },
    due,
    updatedAt: Date.now(),
  });
}
export function LibraryScreen({ placement = false }: { placement?: boolean }) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [cards, setCards] = useState<CardRow[]>([]),
    [open, setOpen] = useState(""),
    [limit, setLimit] = useState(20),
    [message, setMessage] = useState(""),
    [knownCount, setKnownCount] = useState(0),
    [quiz, setQuiz] = useState("");
  const refresh = () => {
    void repo().allCards().then(setCards);
  };
  useEffect(refresh, []);
  const byId = new Map(
    cards.filter((c) => c.kind === "listen").map((c) => [c.itemId, c]),
  );
  const list = (
    placement
      ? WORDS.filter((w) => !w.tags?.includes("chunk")).slice(0, 300)
      : WORDS
  ).filter((w) => {
    const c = byId.get(w.id);
    return (
      `${w.lemma} ${w.ru.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "all" ||
        (filter === "new" && !c) ||
        (filter === "learning" && c && c.fsrs.stability < 21) ||
        (filter === "learned" && c && c.fsrs.stability >= 21) ||
        (filter === "problem" && c && c.fsrs.lapses >= 3))
    );
  });
  async function known(id: string) {
    if (placement && (knownCount + 1) % 5 === 0) {
      setQuiz(id);
      return;
    }
    await markKnown(id);
    setKnownCount((n) => n + 1);
    refresh();
  }
  const qw = WORDS.find((w) => w.id === quiz);
  return (
    <Page title={placement ? "Знакомые слова" : "Словарь"}>
      {placement && (
        <p>
          Отметь знакомые слова. Каждое пятое проверим на слух; остальные всё
          равно вернутся на раннее повторение. Можно закончить в любой момент.
        </p>
      )}
      <input
        aria-label="Поиск по словарю"
        className="min-h-12 border border-line rounded-xl bg-surface px-3"
        placeholder="Слово или перевод"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setLimit(20);
        }}
      />
      {!placement && (
        <select
          aria-label="Фильтр"
          className="min-h-12 rounded-xl border border-line bg-surface px-3"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setLimit(20);
          }}
        >
          <option value="all">Все</option>
          <option value="new">Новые</option>
          <option value="learning">В изучении</option>
          <option value="learned">Выученные</option>
          <option value="problem">Проблемные</option>
        </select>
      )}
      {qw ? (
        <div className={panel}>
          <p>Что значит знакомое слово?</p>
          <SpeakButton text={qw.lemma} />
          {[qw, ...WORDS.filter((w) => w.id !== qw.id).slice(5, 8)]
            .sort((a, b) => a.ru[0]!.localeCompare(b.ru[0]!))
            .map((w) => (
              <button
                key={w.id}
                className="block min-h-12 w-full border-b border-line text-left"
                onClick={() =>
                  void (async () => {
                    if (w.id === qw.id) {
                      await markKnown(qw.id);
                      setMessage("Верно! Слово вернётся через три дня.");
                    } else
                      setMessage(
                        `Ответ: ${qw.ru.join("; ")}. Оставим для изучения.`,
                      );
                    setKnownCount((n) => n + 1);
                    setQuiz("");
                    refresh();
                  })()
                }
              >
                {w.ru[0]}
              </button>
            ))}
        </div>
      ) : (
        list.slice(0, limit).map((w) => {
          const c = byId.get(w.id);
          return (
            <article key={w.id} className={panel}>
              <div className="flex items-center justify-between">
                <button
                  className="text-xl font-semibold min-h-12 text-left"
                  onClick={() => setOpen(open === w.id ? "" : w.id)}
                >
                  {w.lemma}
                </button>
                <SpeakButton text={w.lemma} />
              </div>
              <p className="text-muted text-sm">
                {w.ru.join("; ")}
                {c
                  ? " · " +
                    (c.suspended
                      ? "пауза"
                      : c.fsrs.stability >= 21
                        ? "выучено"
                        : "в изучении")
                  : ""}
              </p>
              {(open === w.id || placement) && (
                <div className="mt-3 flex flex-col gap-3">
                  <p>{w.ipa}</p>
                  {w.note && <p className="text-sm">💡 {w.note}</p>}
                  {w.examples.map((e) => (
                    <p className="text-sm" key={e.en}>
                      {e.en}
                      <br />
                      {e.ru}
                    </p>
                  ))}
                  <button
                    className="min-h-12 text-accent border border-line rounded-xl"
                    onClick={() => void known(w.id)}
                  >
                    Я это знаю
                  </button>
                  {c && (
                    <button
                      className="min-h-12 text-muted"
                      onClick={() =>
                        void repo()
                          .setSuspended(c.id, !c.suspended)
                          .then(refresh)
                      }
                    >
                      {c.suspended ? "Вернуть в повторения" : "Приостановить"}
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })
      )}
      {list.length > limit && (
        <button
          className="min-h-12 text-accent"
          onClick={() => setLimit((n) => n + 20)}
        >
          Ещё 20
        </button>
      )}
      {message && <p role="status">{message}</p>}
      {placement && (
        <a
          className="min-h-14 grid place-items-center bg-accent text-accent-ink rounded-2xl"
          href="#/today"
        >
          Готово, к занятиям
        </a>
      )}
    </Page>
  );
}
