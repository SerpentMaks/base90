import { useEffect, useReducer, useState } from 'react';
import { isStandalone } from '../lib/platform';
import { allVoices, onTtsChange, playBeep, speak, ttsLog, ttsSupported, usVoices } from '../lib/tts';

const PHRASE = 'Hello! Welcome to Base ninety.';

function iosVersion(): string {
  const m = navigator.userAgent.match(/OS (\d+)[_.](\d+)/);
  return m ? `${m[1]}.${m[2]}` : '—';
}

/** Проверка звука + диагностика (на iPhone без неё не понять, что сломалось). */
export function SoundCheck() {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [state, setState] = useState<'idle' | 'playing' | 'error'>('idle');
  const [beep, setBeep] = useState<'idle' | 'ok' | 'error'>('idle');
  useEffect(() => onTtsChange(rerender), []);

  const supported = ttsSupported();
  const voices = allVoices();
  const us = usVoices(voices);

  // onClick синхронно вызывает speak() → speechSynthesis.speak() внутри жеста (требование iOS).
  function run(useDefaultVoice = false) {
    setState('playing');
    speak(PHRASE, { rate: 0.9, useDefaultVoice }).then(
      () => setState('idle'),
      () => setState('error'),
    );
  }

  function runBeep() {
    playBeep().then(
      () => setBeep('ok'),
      () => setBeep('error'),
    );
  }

  const log = ttsLog();

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-semibold">Проверка звука</h2>
      <p className="mt-1 text-sm text-muted">Должен прозвучать американский голос: «Hello! Welcome to Base ninety».</p>
      <button
        onClick={() => run(false)}
        disabled={!supported}
        className="mt-3 min-h-12 w-full rounded-xl bg-accent-soft font-medium text-accent disabled:opacity-60"
      >
        {state === 'playing' ? 'Звучит… (нажми ещё раз, если тихо)' : '🔊 Проверить звук'}
      </button>
      {state === 'error' && (
        <p className="mt-2 text-sm text-bad">Озвучка не запустилась. Открой «Не слышно?» ниже — там подсказки.</p>
      )}
      {!supported && <p className="mt-2 text-sm text-bad">Этот браузер не умеет озвучивать текст. На iPhone открой сайт в Safari.</p>}

      <details className="mt-3 text-sm">
        <summary className="min-h-12 cursor-pointer py-3 text-accent">Не слышно? Диагностика</summary>
        <ol className="list-decimal space-y-1 pl-5 text-muted">
          <li>Прибавь громкость кнопками сбоку, когда звучит фраза: у озвучки бывает своя громкость.</li>
          <li>
            Проверь «Настройки → Универсальный доступ → Устное содержимое → Голоса → Английский»: там должен быть хотя бы
            один голос (лучше скачать «улучшенный»).
          </li>
          <li>Попробуй кнопки ниже и пришли мне скриншот этого блока.</li>
        </ol>
        <div className="mt-3 flex gap-2">
          <button onClick={runBeep} className="min-h-12 flex-1 rounded-xl border border-line px-2">
            Простой сигнал
          </button>
          <button onClick={() => run(true)} disabled={!supported} className="min-h-12 flex-1 rounded-xl border border-line px-2">
            Голос по умолчанию
          </button>
        </div>
        {beep !== 'idle' && (
          <p className="mt-2 text-muted">
            Сигнал: {beep === 'ok' ? 'запущен — если его слышно, динамик в порядке' : 'не запустился'}
          </p>
        )}
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-bg p-3 font-mono text-xs">
          <dt className="text-muted">Озвучка</dt>
          <dd>{supported ? 'есть' : 'нет'}</dd>
          <dt className="text-muted">Голосов</dt>
          <dd>
            {voices.length} (en-US: {us.length})
          </dd>
          <dt className="text-muted">Голос</dt>
          <dd className="break-words">{us[0] ? us[0].name : '—'}</dd>
          <dt className="text-muted">Режим</dt>
          <dd>{isStandalone() ? 'с экрана Домой' : 'в браузере'}</dd>
          <dt className="text-muted">iOS</dt>
          <dd>{iosVersion()}</dd>
          <dt className="text-muted">События</dt>
          <dd className="break-words">
            {log.length ? log.slice(-6).map((e) => (e.detail ? `${e.type}: ${e.detail}` : e.type)).join(' → ') : '—'}
          </dd>
        </dl>
      </details>
    </section>
  );
}
