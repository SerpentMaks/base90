import { dailyPlan } from "../../lib/study";
import { useEffect, useState } from "react";
import { WORD_ORDER } from "../../content";
import { repo } from "../../db/repo";
import type { SessionState } from "../../lib/session";
import { btnPrimary, btnSecondary } from "../exercises/common";
import { navigate } from "../../lib/nav";
import { formatWhen } from "./when";

const CHEERS = [
  "Мозг уже раскладывает слова по полочкам.",
  "Маленькие шаги каждый день — и через 90 дней будет фундамент.",
  "Повторения сделают своё дело: завтра будет легче.",
  "Отличный подход. Можно отдохнуть или сделать ещё один.",
];

export function Summary({
  session,
  onExit,
}: {
  session: SessionState | null;
  onExit: () => void;
}) {
  const [info, setInfo] = useState<{ nextDue: number; newLeft: number } | null>(
    null,
  );

  useEffect(() => {
    void (async () => {
      const cards = await repo().allCards();
      const plan = await dailyPlan();
      const started = new Set(
        cards.filter((c) => c.kind === "listen").map((c) => c.itemId),
      );
      const st = await repo().stats();
      setInfo({
        nextDue: st.nextDue,
        newLeft: Math.min(
          plan.newLeft,
          WORD_ORDER.filter((id) => !started.has(id)).length,
        ),
      });
      if ("setAppBadge" in navigator)
        void (
          navigator as Navigator & { setAppBadge(n: number): Promise<void> }
        )
          .setAppBadge(st.due)
          .catch(() => {});
    })();
  }, []);

  const answered = session?.answered ?? 0;
  const pct = answered
    ? Math.round(((session?.correct ?? 0) / answered) * 100)
    : 0;
  const cheer = CHEERS[(session?.startedAt ?? 0) % CHEERS.length];

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="pt-6 text-center">
        <div className="text-6xl" aria-hidden>
          🎉
        </div>
        <h1 className="mt-3 text-2xl font-bold">Подход завершён</h1>
        <p className="mt-2 text-muted">{cheer}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl border border-line bg-surface p-3">
          <div className="text-2xl font-semibold">
            {session?.introduced.length ?? 0}
          </div>
          <div className="text-xs text-muted">новых слов</div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-3">
          <div className="text-2xl font-semibold">{answered}</div>
          <div className="text-xs text-muted">ответов</div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-3">
          <div className="text-2xl font-semibold">{pct}%</div>
          <div className="text-xs text-muted">верно</div>
        </div>
      </div>
      {info && Number.isFinite(info.nextDue) && (
        <p className="text-center text-sm text-muted">
          Следующее повторение: {formatWhen(info.nextDue)}
        </p>
      )}
      <div className="mt-auto flex flex-col gap-3">
        {info && info.newLeft > 0 && (
          <button
            className={btnSecondary}
            onClick={() => navigate("#/session/new")}
          >
            Ещё новые слова
          </button>
        )}
        <a
          className={btnSecondary + " grid place-items-center"}
          href="#/course"
        >
          Продолжить: уроки и аудирование
        </a>
        <button className={btnPrimary} onClick={onExit}>
          На главную
        </button>
      </div>
    </div>
  );
}
