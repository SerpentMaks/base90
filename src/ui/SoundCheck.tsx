import { useEffect, useReducer, useState } from 'react';
import { isStandalone } from '../lib/platform';
import {
  allVoices,
  currentVoice,
  onTtsChange,
  playBeep,
  setPreferredVoiceURI,
  SYSTEM_VOICE,
  usesSystemVoice,
  speak,
  ttsLog,
  ttsSupported,
  usVoices,
  voiceQuality,
  type VoiceQuality,
} from '../lib/tts';

const PHRASE = 'Hello! Welcome to Base ninety.';

const QUALITY_LABEL: Record<VoiceQuality, string> = {
  premium: '★ премиум',
  enhanced: 'улучшенный',
  standard: 'обычный',
  basic: 'простой',
  robotic: 'роботизированный',
  novelty: 'шуточный',
};

function shortName(name: string): string {
  return name.replace(/\s*\((английский|english)[^)]*\)\)?/i, '').trim();
}

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
  const voice = currentVoice();
  const hasGood = us.some((v) => ['premium', 'enhanced'].includes(voiceQuality(v)));

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

      {us.length > 0 && (
        <div className="mt-4">
          <label htmlFor="voice" className="text-sm font-medium">
            Голос
          </label>
          <div className="mt-1 flex gap-2">
            <select
              id="voice"
              value={usesSystemVoice() ? SYSTEM_VOICE : (voice?.voiceURI ?? '')}
              onChange={(e) => {
                setPreferredVoiceURI(e.target.value || null);
                setState('idle');
              }}
              className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-base"
            >
              <option value={SYSTEM_VOICE}>Системный голос iPhone</option>
              {us.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {shortName(v.name)} — {QUALITY_LABEL[voiceQuality(v)]}
                </option>
              ))}
            </select>
            <button
              onClick={() => run(false)}
              aria-label="Прослушать выбранный голос"
              className="min-h-12 rounded-xl bg-accent px-4 font-medium text-accent-ink"
            >
              ▶
            </button>
          </div>
          {!hasGood && (
            <p className="mt-2 text-sm text-muted">
              С iOS 18 Safari не даёт сайтам хорошие голоса iPhone (даже скачанные) — остаются только простые синтезаторы.
              Попробуй «Системный голос iPhone» и голоса с пометкой «простой». Скоро в Base90 будут свои записи качественным
              нейроголосом.
            </p>
          )}
        </div>
      )}

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
          <dd className="break-words">{usesSystemVoice() ? 'системный (не задан)' : voice ? `${voice.name} [${voiceQuality(voice)}]` : '—'}</dd>
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
