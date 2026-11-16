import { useEffect, useState } from 'react';
import { WORDS } from '../../content';
import { repo } from '../../db/repo';
import { unlockAudio } from '../../lib/audio';
import { navigate } from '../../lib/nav';
import { remaining } from '../../lib/session';
import { unlockSfx } from '../../lib/sfx';
import { formatDateRu, studyDate } from '../../lib/time';
import { InstallHint } from '../../ui/InstallHint';
import { Ring } from '../../ui/Ring';
import { formatWhen } from '../session/when';

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
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

type Info = { due: number; started: number; learning: number; nextDue: number; canResume: boolean };

export function TodayScreen() {
  const today = studyDate();
  const online = useOnline();
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    void (async () => {
      const [st, saved] = await Promise.all([repo().stats(), repo().loadSession()]);
      setInfo({ ...st, canResume: !!saved && saved.studyDate === today && remaining(saved) > 0 });
      const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
      if (st.due > 0) void nav.setAppBadge?.(st.due).catch(() => {});
      else void nav.clearAppBadge?.().catch(() => {});
    })();
  }, [today]);

  const total = WORDS.length;
  const newLeft = info ? total - info.started : 0;
  const nothing = info && !info.canResume && info.due === 0 && newLeft === 0;

  function start() {
    // Жест пользователя: разблокируем звук на iOS до перехода к первой карточке.
    unlockAudio();
    unlockSfx();
    navigate(info?.canResume ? '#/session' : '#/session/new');
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-6 pb-24">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">{formatDateRu(today)}</p>
          <h1 className="text-3xl font-bold">Сегодня</h1>
        </div>
        <a href="#/settings" aria-label="Настройки" className="grid h-12 w-12 place-items-center rounded-full text-2xl text-muted">
          ⚙︎
        </a>
      </header>

      <div className="flex flex-col items-center gap-5 rounded-3xl border border-line bg-surface p-6">
        <Ring value={info?.started ?? 0} max={total} label={`${info?.started ?? 0} / ${total}`} sublabel="слов начато" />
        <button
          onClick={start}
          disabled={!info || !!nothing}
          className="min-h-14 w-full rounded-2xl bg-accent text-lg font-semibold text-accent-ink transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {nothing ? 'На сейчас всё 🎉' : info?.canResume ? 'Продолжить' : 'Начать'}
        </button>
        {nothing && info && Number.isFinite(info.nextDue) && (
          <p className="-mt-2 text-center text-sm text-muted">Следующее повторение: {formatWhen(info.nextDue)}</p>
        )}
      </div>

      <div className="flex gap-3">
        <Stat value={String(info?.due ?? 0)} label="к повторению" />
        <Stat value={String(info?.learning ?? 0)} label="в изучении" />
        <Stat value={String(newLeft)} label="новых слов" />
      </div>

      <p className="rounded-2xl bg-accent-soft p-4 text-sm">
        Это тестовая версия: 10 слов, чтобы проверить повторения. Полный словарь (~1300 слов), дневной план по минутам и стрик
        появятся на следующих этапах.
      </p>

      <InstallHint />

      <footer className="text-center text-xs text-muted">
        <p>{online ? 'Онлайн' : 'Нет сети — приложение работает офлайн'}</p>
        <p className="mt-1">Версия {__APP_VERSION__}</p>
      </footer>
    </main>
  );
}
