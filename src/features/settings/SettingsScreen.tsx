import { useState } from "react";
import { repo } from "../../db/repo";
import { say } from "../../lib/speech";
import { updateSettings, useSettings } from "../../lib/settings";
import { SoundCheck } from "../../ui/SoundCheck";
import { clearPersonalWords } from "../../content";
import { setSyncConfig } from "../../lib/sync";
import { BackupPanel } from "../backup/BackupPanel";

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-14 items-center justify-between gap-4 py-2">
      <span>
        <span className="block">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
      <input
        type="checkbox"
        className="h-6 w-6 shrink-0 accent-[var(--color-accent)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
        <a
          href="#/today"
          aria-label="Назад"
          className="grid h-12 w-12 place-items-center rounded-full text-2xl text-muted"
        >
          ‹
        </a>
        <h1 className="text-2xl font-bold">Настройки</h1>
      </header>

      <Section title="Звук">
        <Toggle
          label="Озвучивать автоматически"
          hint="Английское слово звучит сразу при показе"
          checked={s.autoplay}
          onChange={(v) => void updateSettings({ autoplay: v })}
        />
        <Toggle
          label="Показывать транскрипцию"
          hint="Например /noʊ/"
          checked={s.showIpa}
          onChange={(v) => void updateSettings({ showIpa: v })}
        />
        <div className="flex min-h-14 items-center justify-between gap-3 py-2">
          <span>
            <span className="block">Голос курса</span>
            <span className="block text-sm text-muted">
              Heart — записи нейроголосом, работают офлайн
            </span>
          </span>
          <button
            onClick={() =>
              void say("Hello! Let's learn some English.").catch(() => {})
            }
            className="min-h-12 rounded-xl bg-accent-soft px-4 text-accent"
          >
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
            onChange={(e) =>
              void updateSettings({ retention: Number(e.target.value) / 100 })
            }
            className="mt-2 w-full accent-[var(--color-accent)]"
          />
          <span className="mt-1 block text-sm text-muted">
            Выше — повторений больше, но слова держатся крепче. 90% — оптимум
            для большинства.
          </span>
        </label>
      </Section>

      <Section title="Скорость голоса">
        <label>
          Скорость: {s.speechRate.toFixed(2)}
          <input
            className="w-full min-h-12"
            type="range"
            min={0.75}
            max={1.25}
            step={0.05}
            value={s.speechRate}
            onChange={(e) =>
              void updateSettings({ speechRate: Number(e.target.value) })
            }
          />
        </label>
      </Section>
      <SoundCheck />
      <Section title="Время занятий">
        {(["start", "step", "period", "cap"] as const).map((key, i) => (
          <label
            key={key}
            className="flex justify-between items-center gap-3 py-2"
          >
            <span>
              {
                [
                  "Начало, минут",
                  "Прибавка, минут",
                  "Каждые учебных дней",
                  "Потолок, минут",
                ][i]
              }
            </span>
            <input
              type="number"
              min={key === "period" ? 1 : key === "step" ? 0 : 5}
              max={key === "period" ? 30 : key === "step" ? 30 : 180}
              value={s.time[key]}
              className="min-h-12 w-20 rounded-xl border border-line bg-bg p-2"
              onChange={(e) => {
                const v = Number(e.target.value);
                if (
                  Number.isFinite(v) &&
                  v >= (key === "step" ? 0 : key === "period" ? 1 : 5) &&
                  v <= (key === "period" ? 30 : key === "step" ? 30 : 180)
                )
                  void updateSettings({
                    time: {
                      ...s.time,
                      [key]: v,
                      cap:
                        key === "start"
                          ? Math.max(v, s.time.cap)
                          : key === "cap"
                            ? Math.max(v, s.time.start)
                            : s.time.cap,
                    },
                  });
              }}
            />
          </label>
        ))}
      </Section>
      <BackupPanel />

      <Section title="Данные">
        <p className="text-sm text-muted">
          Перед сбросом сохрани копию прогресса. При подключённом Gist импорт
          или синхронизация могут вернуть сохранённые там записи.
        </p>
        <button
          className={`mt-3 min-h-12 w-full rounded-xl border px-3 ${confirmReset ? "border-bad bg-bad/10 text-bad" : "border-line"}`}
          onClick={async () => {
            if (confirmReset < 1) return setConfirmReset(1);
            await setSyncConfig(null);
            await repo().resetProgress();
            clearPersonalWords();
            setConfirmReset(2);
          }}
        >
          {confirmReset === 0
            ? "Сбросить прогресс"
            : confirmReset === 1
              ? "Точно? Нажми ещё раз — всё обнулится"
              : "Прогресс сброшен"}
        </button>
      </Section>
      <a
        className="min-h-12 grid place-items-center text-accent"
        href="#/sources"
      >
        Источники и лицензии
      </a>

      <p className="text-center text-xs text-muted">Версия {__APP_VERSION__}</p>
    </main>
  );
}
