import { useState } from 'react';
import { isIOS, isStandalone } from '../lib/platform';

/** Короткая подсказка «Установи на экран Домой». Полная пошаговая — в онбординге. */
export function InstallHint() {
  const [hidden, setHidden] = useState(() => isStandalone());
  if (hidden) return null;
  const ios = isIOS();
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-semibold">Установи приложение</h2>
      {ios ? (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Открой этот сайт в <b className="text-ink">Safari</b>.</li>
          <li>Нажми «Поделиться» <span aria-hidden>⎋</span> внизу экрана.</li>
          <li>Выбери «На экран Домой» → «Добавить».</li>
          <li>Открывай Base90 с иконки — так работают офлайн и напоминания.</li>
        </ol>
      ) : (
        <p className="mt-2 text-sm text-muted">
          В меню браузера выбери «Установить приложение» или «Добавить на главный экран».
        </p>
      )}
      <button className="mt-3 min-h-12 text-sm text-accent" onClick={() => setHidden(true)}>
        Понятно, скрыть
      </button>
    </section>
  );
}
