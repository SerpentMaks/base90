import { useEffect, useState } from "react";
import {
  db,
  type CardRow,
  type DayRow,
  type ReviewLogRow,
  type KvRow,
} from "../../db/db";
import { dailyPlan } from "../../lib/study";
import { retention } from "../../lib/planner";
import { addDays, studyDate } from "../../lib/time";
import { Page, panel } from "../../ui/Page";
export function StatsScreen() {
  const [data, setData] = useState<{
    cards: CardRow[];
    days: DayRow[];
    logs: ReviewLogRow[];
    progress: KvRow[];
    day: number;
  } | null>(null);
  useEffect(() => {
    void Promise.all([
      db.cards.toArray(),
      db.days.toArray(),
      db.reviewLogs.toArray(),
      db.progress.toArray(),
      dailyPlan(),
    ]).then(([cards, days, logs, progress, p]) =>
      setData({ cards, days, logs, progress, day: p.studyDay }),
    );
  }, []);
  if (!data)
    return (
      <Page title="Прогресс">
        <p>Загрузка…</p>
      </Page>
    );
  const listen = data.cards.filter((c) => c.kind === "listen"),
    learned = listen.filter((c) => c.fsrs.stability >= 21).length;
  const minutes = data.days.reduce((n, d) => n + d.activeMin, 0),
    today = studyDate();
  const heat = Array.from({ length: 91 }, (_, i) => addDays(today, i - 90));
  const r = (n: number) => {
    const v = retention(data.logs, Date.now() - n * 86400000);
    return v === null ? "Пока мало данных" : `${Math.round(v * 100)}%`;
  };
  const week = data.days.filter((d) => d.date >= addDays(today, -6));
  const tests = data.progress.filter((r) => r.key.startsWith("test:"));
  return (
    <Page title="Прогресс">
      <h2 className="text-2xl font-bold">Учебный день {data.day} из 90</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className={panel}>
          <b className="text-3xl">{learned}</b>
          <p className="text-sm text-muted">слов закреплено</p>
        </div>
        <div className={panel}>
          <b className="text-3xl">{(minutes / 60).toFixed(1)}</b>
          <p className="text-sm text-muted">часов занятий</p>
        </div>
      </div>
      <p className="text-sm text-muted">
        Закреплено = устойчивость памяти FSRS от 21 дня. Ещё{" "}
        {listen.length - learned} в изучении.
      </p>
      <section className={panel}>
        <h2 className="font-semibold">Последние 13 недель</h2>
        <div className="grid grid-cols-13 gap-1 mt-3">
          {heat.map((date) => {
            const day = data.days.find((d) => d.date === date);
            return (
              <div
                key={date}
                title={`${date}: ${Math.round(day?.activeMin ?? 0)} мин`}
                aria-label={`${date}: ${Math.round(day?.activeMin ?? 0)} минут`}
                className="aspect-square rounded-sm"
                style={{
                  background:
                    (day?.activeMin ?? 0) > 0
                      ? "var(--color-accent)"
                      : "var(--color-line)",
                  opacity: day?.activeMin
                    ? Math.max(0.35, Math.min(1, day.activeMin / 45))
                    : 1,
                }}
              />
            );
          })}
        </div>
      </section>
      <section className={panel}>
        <h2 className="font-semibold">Память</h2>
        <p>За 7 дней: {r(7)}</p>
        <p>За 30 дней: {r(30)}</p>
        <p className="text-xs text-muted mt-2">
          Доля успешных ответов только на карточках, вышедших из первоначальных
          шагов изучения.
        </p>
      </section>
      <section className={panel}>
        <h2 className="font-semibold">Повторения на неделю</h2>
        {Array.from({ length: 7 }, (_, i) => {
          const date = addDays(today, i + 1);
          const count = data.cards.filter(
            (c) =>
              !c.suspended &&
              studyDate(new Date(Math.max(c.due, c.availableAt))) === date,
          ).length;
          return (
            <p className="flex justify-between text-sm py-1" key={date}>
              <span>{date}</span>
              <b>{count}</b>
            </p>
          );
        })}
      </section>
      <section className={panel}>
        <h2 className="font-semibold">Итоги недели</h2>
        <p>
          {Math.round(week.reduce((n, d) => n + d.activeMin, 0))} минут ·{" "}
          {week.reduce((n, d) => n + d.newIntroduced, 0)} новых элементов
        </p>
        <p className="text-sm text-muted mt-2">
          {retention(data.logs, Date.now() - 7 * 86400000) !== null &&
          retention(data.logs, Date.now() - 7 * 86400000)! < 0.8
            ? "На следующей неделе начни с повторений и оставь меньше новых слов."
            : "Попробуй пересказать одну историю вслух — даже двумя фразами."}
        </p>
      </section>
      <section className={panel}>
        <h2 className="font-semibold">Тесты месяца</h2>
        {[28, 56, 90].map((day) => (
          <a
            key={day}
            className="flex min-h-12 items-center justify-between text-accent"
            href={`#/test/${day}`}
          >
            День {day}
            <span>{data.day >= day ? "Пройти" : "Попробовать заранее"}</span>
          </a>
        ))}
        {tests.map((t) => {
          const v = t.value as { correct: number; total: number; at: number };
          return (
            <p className="text-sm text-muted" key={t.key}>
              {new Date(v.at).toLocaleDateString("ru-RU")} · {v.correct}/
              {v.total}
            </p>
          );
        })}
      </section>
      <section className={panel}>
        <h2 className="font-semibold">Вехи</h2>
        <p>
          {[100, 250, 500, 1000]
            .map((n) => `${listen.length >= n ? "✓" : "○"} ${n} слов`)
            .join(" · ")}
        </p>
        <p className="mt-2">
          {[7, 30, 60, 90]
            .map(
              (n) =>
                `${data.days.filter((d) => d.counted).length >= n ? "✓" : "○"} ${n} дней`,
            )
            .join(" · ")}
        </p>
        <p className="mt-2">
          XP:{" "}
          {Math.floor(minutes) * 2 +
            data.logs.filter((l) => l.rating > 1).length * 5}
        </p>
      </section>
      <section className={panel}>
        <h2 className="font-semibold">Путь к фильмам</h2>
        <progress className="w-full my-2" value={learned} max={3000} />
        <p>{learned} / 3000 слов</p>
        <p className="text-sm text-muted mt-2">
          Для покрытия около 95% слов в фильмах Webb и Rodgers оценивали объём
          примерно в 3000 словарных семей, для 98% — около 6000. Семья слов и
          карточка — разные единицы, поэтому шкала лишь ориентир. Эти 90 дней —
          фундамент.
        </p>
      </section>
      {data.day > 90 && (
        <div className={panel}>
          <h2 className="font-bold">Курс продолжается</h2>
          <p>
            Сохрани повторения, добавляй новые слова и смотри короткие сцены с
            английскими субтитрами. Каждую неделю увеличивай время слушания на
            5–10 минут.
          </p>
        </div>
      )}
    </Page>
  );
}
