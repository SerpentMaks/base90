import { useEffect, useState } from 'react';
import { Ring } from '../../ui/Ring';
import { InstallHint } from '../../ui/InstallHint';
import { formatDateRu, studyDate } from '../../lib/time';
import { speak, ttsSupported } from '../../lib/tts';

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

export function TodayScreen() {
  const today = studyDate();
  const online = useOnline();
  const [sound, setSound] = useState<'idle' | 'playing' | 'error'>('idle');

  // Этап 1: план и сессии ещё не подключены — показываем стартовые значения.
  const plannedMin = 20;
  const activeMin = 0;

  async function checkSound() {
    setSound('playing');
    try {
      await speak('Hello! Welcome to Base ninety.', { rate: 0.9 });
      setSound('idle');
    } catch {
      setSound('error');
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-6 pb-24">
      <header>
        <p className="text-sm text-muted">{formatDateRu(today)}</p>
        <h1 className="text-3xl font-bold">Сегодня</h1>
      </header>

      <div className="flex flex-col items-center gap-5 rounded-3xl border border-line bg-surface p-6">
        <Ring value={activeMin} max={plannedMin} label={`${activeMin} / ${plannedMin}`} sublabel="минут" />
        <button
          disabled
          className="min-h-14 w-full rounded-2xl bg-accent text-lg font-semibold text-accent-ink disabled:opacity-50"
        >
          Начать
        </button>
        <p className="-mt-2 text-center text-sm text-muted">
          Занятия появятся на следующем этапе. Пока можно проверить звук и установку.
        </p>
      </div>

      <div className="flex gap-3">
        <Stat value="0 🔥" label="дней подряд" />
        <Stat value="0 ❄️" label="заморозки" />
        <Stat value="0" label="к повторению" />
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-semibold">Проверка звука</h2>
        <p className="mt-1 text-sm text-muted">
          Должен прозвучать американский голос. Если тихо — проверь переключатель «Без звука» сбоку iPhone.
        </p>
        <button
          onClick={checkSound}
          disabled={!ttsSupported() || sound === 'playing'}
          className="mt-3 min-h-12 w-full rounded-xl bg-accent-soft font-medium text-accent disabled:opacity-60"
        >
          {sound === 'playing' ? 'Звучит…' : '🔊 Проверить звук'}
        </button>
        {(sound === 'error' || !ttsSupported()) && (
          <p className="mt-2 text-sm text-bad">Озвучка недоступна в этом браузере. На iPhone открой сайт в Safari.</p>
        )}
      </section>

      <InstallHint />

      <footer className="text-center text-xs text-muted">
        <p>{online ? 'Онлайн' : 'Нет сети — приложение работает офлайн'}</p>
        <p className="mt-1">Версия {__APP_VERSION__}</p>
      </footer>
    </main>
  );
}
