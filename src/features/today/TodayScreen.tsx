import { useEffect, useState } from "react";
import { dailyPlan, ensureDay } from "../../lib/study";
import { db } from "../../db/db";
import { WORDS } from "../../content";
import { repo } from "../../db/repo";
import { unlockAudio } from "../../lib/audio";
import { navigate } from "../../lib/nav";
import { remaining } from "../../lib/session";
import { unlockSfx } from "../../lib/sfx";
import { formatDateRu, studyDate } from "../../lib/time";
import { InstallHint } from "../../ui/InstallHint";
import { Ring } from "../../ui/Ring";
import { formatWhen } from "../session/when";

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 rounded-2xl border border-line bg-surface p-3 text-center">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-muted">{label}</div>
    </div>
  );
}

type Info = {
  due: number;
  started: number;
  learning: number;
  nextDue: number;
  canResume: boolean;
};

export function TodayScreen() {
  const today = studyDate();
  const [pushError, setPushError] = useState("");
  useEffect(() => {
    void db.progress
      .get("private:pushError")
      .then((row) =>
        setPushError(typeof row?.value === "string" ? row.value : ""),
      );
  }, []);
  const [plan, setPlan] = useState<Awaited<
    ReturnType<typeof dailyPlan>
  > | null>(null);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void ensureDay()
        .then(dailyPlan)
        .then((p) => {
          if (alive) setPlan(p);
        });
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    const visible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("study-update", refresh);
    window.addEventListener("sync-update", refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("study-update", refresh);
      window.removeEventListener("sync-update", refresh);
    };
  }, []);
  const online = useOnline();
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void (async () => {
        const [st, saved] = await Promise.all([
          repo().stats(),
          repo().loadSession(),
        ]);
        if (!alive) return;
        setInfo({
          ...st,
          canResume:
            !!saved && saved.studyDate === today && remaining(saved) > 0,
        });
        const nav = navigator as Navigator & {
          setAppBadge?: (n: number) => Promise<void>;
          clearAppBadge?: () => Promise<void>;
        };
        if (st.due > 0) void nav.setAppBadge?.(st.due).catch(() => {});
        else void nav.clearAppBadge?.().catch(() => {});
      })();
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    const visible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [today]);

  const total = WORDS.length;
  const newLeft = info ? total - info.started : 0;
  const nothing = info && !info.canResume && info.due === 0 && newLeft === 0;

  function start() {
    // Жест пользователя: разблокируем звук на iOS до перехода к первой карточке.
    unlockAudio();
    unlockSfx();
    void (async () => {
      const [st, p, saved] = await Promise.all([
        repo().stats(),
        dailyPlan(),
        repo().loadSession(),
      ]);
      const resume =
        !!saved && saved.studyDate === studyDate() && remaining(saved) > 0;
      if (!resume && st.due === 0 && p.newLeft === 0) {
        navigate("#/course");
        return;
      }
      navigate(resume ? "#/session" : "#/session/new");
    })();
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-6 pb-24">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">{formatDateRu(today)}</p>
          <h1 className="text-3xl font-bold">Сегодня</h1>
        </div>
        <a
          href="#/settings"
          aria-label="Настройки"
          className="grid h-12 w-12 place-items-center rounded-full text-2xl text-muted"
        >
          ⚙︎
        </a>
      </header>

      <div className="flex flex-col items-center gap-5 rounded-3xl border border-line bg-surface p-6">
        <Ring
          value={plan?.activeMin ?? 0}
          max={plan?.minutes ?? 20}
          label={`${Math.floor(plan?.activeMin ?? 0)} / ${plan?.minutes ?? 20}`}
          sublabel="активных минут"
        />
        <button
          onClick={start}
          disabled={!info || !!nothing}
          className="min-h-14 w-full rounded-2xl bg-accent text-lg font-semibold text-accent-ink transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {nothing
            ? "На сейчас всё 🎉"
            : info?.canResume
              ? "Продолжить"
              : "Начать"}
        </button>
        {nothing && info && Number.isFinite(info.nextDue) && (
          <p className="-mt-2 text-center text-sm text-muted">
            Следующее повторение: {formatWhen(info.nextDue)}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <Stat value={String(info?.due ?? 0)} label="к повторению" />
        <Stat value={String(info?.learning ?? 0)} label="в изучении" />
        <Stat value={String(newLeft)} label="новых элементов" />
      </div>

      <div className="rounded-2xl bg-accent-soft p-4 text-sm">
        <p className="font-semibold">
          🔥 Серия {plan?.streak.count ?? 0} · ❄ {plan?.streak.freezes ?? 0} ·
          День {plan?.studyDay ?? 1}
        </p>
        <p className="mt-2">
          {plan && plan.activeMin >= plan.minutes
            ? "План выполнен 🎉 Можно отдохнуть или продолжить по желанию."
            : plan?.overloaded
              ? "Сегодня разгребаем повторения — это нормально. Новые слова подождут."
              : plan?.returning
                ? "С возвращением! Два дня начнём с повторений и меньшей нагрузки."
                : plan?.lowRetention
                  ? "Укрепим память: сегодня новых слов немного меньше."
                  : "Начни с короткого подхода. Уроки и аудирование тоже входят в дневное время."}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <a
          className="rounded-2xl border border-line bg-surface p-4 min-h-20"
          href="#/course"
        >
          📖 Уроки и истории
        </a>
        <a
          className="rounded-2xl border border-line bg-surface p-4 min-h-20"
          href="#/practice/sounds"
        >
          🎧 Звуки
        </a>
        <a
          className="rounded-2xl border border-line bg-surface p-4 min-h-20"
          href="#/practice/dictation"
        >
          ✍ Диктант
        </a>
        <a
          className="rounded-2xl border border-line bg-surface p-4 min-h-20"
          href="#/practice/shadow"
        >
          🎙 Повтори за голосом
        </a>
        <a
          className="rounded-2xl border border-line bg-surface p-4 min-h-20"
          href="#/mistakes"
        >
          ↻ Ошибочник
        </a>
        <a
          className="rounded-2xl border border-line bg-surface p-4 min-h-20"
          href="#/film"
        >
          🎬 Мост к фильмам
        </a>
      </div>
      {plan &&
        [28, 56, 90].some(
          (d) => plan.studyDay >= d && plan.studyDay < d + 7,
        ) && (
          <a
            className="rounded-2xl bg-accent-soft p-4"
            href={`#/test/${plan.studyDay >= 90 ? 90 : plan.studyDay >= 56 ? 56 : 28}`}
          >
            Пора пройти тест месяца →
          </a>
        )}

      {pushError && (
        <a href="#/settings" className="rounded-xl bg-accent-soft p-3 text-sm">
          {pushError}
        </a>
      )}
      <InstallHint />

      <footer className="text-center text-xs text-muted">
        <p>
          {online
            ? "Онлайн"
            : navigator.serviceWorker?.controller
              ? "Нет сети — приложение работает офлайн"
              : "Нет сети — часть материалов ещё не загружена"}
        </p>
        <p className="mt-1">Версия {__APP_VERSION__}</p>
      </footer>
    </main>
  );
}
