import { useState } from 'react';
import { repo } from '../../db/repo';
import { say } from '../../lib/speech';
import { updateSettings, useSettings } from '../../lib/settings';
import { SoundCheck } from '../../ui/SoundCheck';

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-14 items-center justify-between gap-4 py-2">
      <span>
        <span className="block">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
      <input type="checkbox" className="h-6 w-6 shrink-0 accent-[var(--color-accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-1 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsScreen() {
  const s = useSettings();
  const [confirmReset, setConfirmReset] = useState(0);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pt-4 pb-24">
      <header className="flex items-center gap-2">
        <a href="#/today" aria-label="Назад" className="grid h-12 w-12 place-items-center rounded-full text-2xl text-muted">
          ‹
        </a>
        <h1 className="text-2xl font-bold">Настройки</h1>
      </header>

      <Section title="Звук">
        <Toggle label="Озвучивать автоматически" hint="Английское слово звучит сразу при показе" checked={s.autoplay} onChange={(v) => void updateSettings({ autoplay: v })} />
        <Toggle label="Показывать транскрипцию" hint="Например /noʊ/" checked={s.showIpa} onChange={(v) => void updateSettings({ showIpa: v })} />
        <div className="flex min-h-14 items-center justify-between gap-3 py-2">
          <span>
            <span className="block">Голос курса</span>
            <span className="block text-sm text-muted">Heart — записи нейроголосом, работают офлайн</span>
          </span>
          <button onClick={() => void say("Hello! Let's learn some English.").catch(() => {})} className="min-h-12 rounded-xl bg-accent-soft px-4 text-accent">
            ▶
          </button>
        </div>
      </Section>

      <Section title="Повторения">
        <label className="block py-2">
          <span className="flex justify-between">
            <span>Насколько хорошо помнить</span>
            <b className="tabular-nums">{Math.round(s.retention * 100)}%</b>
          </span>
          <input
            type="range"
            min={85}
            max={95}
            step={1}
            value={Math.round(s.retention * 100)}
            onChange={(e) => void updateSettings({ retention: Number(e.target.value) / 100 })}
            className="mt-2 w-full accent-[var(--color-accent)]"
          />
          <span className="mt-1 block text-sm text-muted">
            Выше — повторений больше, но слова держатся крепче. 90% — оптимум для большинства.
          </span>
        </label>
      </Section>

      <SoundCheck />

      <Section title="Данные">
        <p className="text-sm text-muted">Прогресс хранится только на этом устройстве. Синхронизация и бэкап появятся на этапе 8.</p>
        <button
          className={`mt-3 min-h-12 w-full rounded-xl border px-3 ${confirmReset ? 'border-bad bg-bad/10 text-bad' : 'border-line'}`}
          onClick={async () => {
            if (confirmReset < 1) return setConfirmReset(1);
            await repo().resetProgress();
            setConfirmReset(2);
          }}
        >
          {confirmReset === 0 ? 'Сбросить прогресс' : confirmReset === 1 ? 'Точно? Нажми ещё раз — всё обнулится' : 'Прогресс сброшен'}
        </button>
      </Section>

      <p className="text-center text-xs text-muted">Версия {__APP_VERSION__}</p>
    </main>
  );
}
