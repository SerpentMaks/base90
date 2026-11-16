import { useState } from 'react';
import { playClip } from '../lib/audio';

/** Пробные голоса нейросети Kokoro — пользователь выбирает, каким озвучить курс. */
const VOICES = [
  { id: 'af_heart', label: 'Женский 1', name: 'Heart' },
  { id: 'af_bella', label: 'Женский 2', name: 'Bella' },
  { id: 'am_michael', label: 'Мужской 1', name: 'Michael' },
  { id: 'am_fenrir', label: 'Мужской 2', name: 'Fenrir' },
] as const;

const KEY = 'base90.neuralVoice';

function load(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function NeuralVoicePicker() {
  const [chosen, setChosen] = useState<string | null>(load);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState(false);

  function pick(id: string) {
    setChosen(id);
    setError(false);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* не запоминаем — не страшно */
    }
    setPlaying(id);
    playClip(`audio/demo/${id}.m4a`).then(
      () => setPlaying((p) => (p === id ? null : p)),
      () => {
        setPlaying(null);
        setError(true);
      },
    );
  }

  const current = VOICES.find((v) => v.id === chosen);

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-semibold">Нейроголос: выбери, каким озвучить курс</h2>
      <p className="mt-1 text-sm text-muted">
        Это записи, а не синтез Safari: звучат одинаково на любом iPhone и без интернета. Фраза: «Hello! Welcome to Base
        ninety. I don&apos;t know what&apos;s going on.»
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Нейроголос">
        {VOICES.map((v) => (
          <button
            key={v.id}
            role="radio"
            aria-checked={chosen === v.id}
            onClick={() => pick(v.id)}
            className={`min-h-14 rounded-xl border px-3 text-left transition-colors ${
              chosen === v.id ? 'border-accent bg-accent-soft' : 'border-line'
            }`}
          >
            <div className="font-medium">
              {playing === v.id ? '🔊 ' : '▶ '}
              {v.label}
            </div>
            <div className="text-xs text-muted">{v.name}</div>
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-bad">Не удалось воспроизвести запись. Проверь громкость и попробуй ещё раз.</p>}
      {current && (
        <p className="mt-3 text-sm">
          Выбран: <b>{current.label}</b> ({current.name}). Напиши мне, какой понравился — им будет озвучен весь курс.
        </p>
      )}
    </section>
  );
}
