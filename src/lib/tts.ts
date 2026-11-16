/**
 * Озвучка через Web Speech API. Абстракция speak(), чтобы позже можно было
 * подменить на заранее сгенерированные аудиофайлы.
 *
 * Важно для iOS Safari:
 *  - первый speechSynthesis.speak() должен быть вызван СИНХРОННО внутри обработчика
 *    тапа. Любой await/setTimeout до него — и iOS молча ничего не воспроизводит;
 *  - список голосов может быть пустым при старте и наполняться позже (voiceschanged
 *    срабатывает не всегда), поэтому говорим даже без выбранного голоса — с lang='en-US';
 *  - cancel() сразу перед speak() иногда «съедает» новую фразу → отменяем только если
 *    что-то реально звучит, и тогда говорим с небольшой паузой.
 */
export type SpeakOptions = { rate?: number; voiceURI?: string; useDefaultVoice?: boolean };

export type TtsEvent = { t: number; type: string; detail?: string };

let voicesCache: SpeechSynthesisVoice[] = [];
let current: SpeechSynthesisUtterance | null = null; // держим ссылку, иначе события могут потеряться
const log: TtsEvent[] = [];
const listeners = new Set<() => void>();

function note(type: string, detail?: string) {
  log.push({ t: Date.now(), type, detail });
  if (log.length > 30) log.shift();
  listeners.forEach((fn) => fn());
}

export function ttsLog(): readonly TtsEvent[] {
  return log;
}

export function onTtsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function refreshVoices(): SpeechSynthesisVoice[] {
  const v = speechSynthesis.getVoices();
  if (v.length) voicesCache = v;
  return voicesCache;
}

/** Вызвать при старте приложения: прогревает список голосов. */
export function initTts(): void {
  if (!ttsSupported()) return;
  refreshVoices();
  speechSynthesis.addEventListener('voiceschanged', () => {
    refreshVoices();
    listeners.forEach((fn) => fn());
  });
}

/** Голоса грузятся асинхронно: ждём (не дольше timeoutMs). НЕ вызывать перед speak() в обработчике тапа. */
export function loadVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported()) return Promise.resolve([]);
  if (refreshVoices().length) return Promise.resolve(voicesCache);
  return new Promise((resolve) => {
    const done = () => {
      speechSynthesis.removeEventListener('voiceschanged', done);
      clearTimeout(timer);
      resolve(refreshVoices());
    };
    const timer = setTimeout(done, timeoutMs);
    speechSynthesis.addEventListener('voiceschanged', done);
  });
}

export function allVoices(): SpeechSynthesisVoice[] {
  return ttsSupported() ? refreshVoices() : [];
}

/** Американские голоса, «улучшенные» системные — первыми. */
export function usVoices(voices: SpeechSynthesisVoice[] = voicesCache): SpeechSynthesisVoice[] {
  const score = (v: SpeechSynthesisVoice) =>
    (/enhanced|premium|neural|natural|улучш/i.test(v.name) ? 2 : 0) + (v.localService ? 1 : 0);
  return voices
    .filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('en-us'))
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
}

/**
 * Произнести текст. speechSynthesis.speak() вызывается синхронно — можно
 * вызывать прямо из onClick. Промис завершается по окончании фразы.
 */
export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!ttsSupported()) {
    note('error', 'speechSynthesis не поддерживается');
    return Promise.reject(new Error('no-tts'));
  }
  const synth = window.speechSynthesis;
  const list = usVoices(refreshVoices());
  const voice = opts.useDefaultVoice ? undefined : (list.find((v) => v.voiceURI === opts.voiceURI) ?? list[0]);

  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  if (voice) u.voice = voice;
  u.rate = opts.rate ?? 1;
  u.volume = 1;
  current = u;
  note('speak', voice ? `${voice.name} (${voice.lang})` : 'голос по умолчанию, en-US');

  return new Promise<void>((resolve, reject) => {
    let started = false;
    const watchdog = setTimeout(() => {
      if (!started && current === u) {
        note('error', 'звук не начался за 4 с');
        reject(new Error('no-start'));
      }
    }, 4000);
    u.onstart = () => {
      started = true;
      note('start');
    };
    u.onend = () => {
      clearTimeout(watchdog);
      note('end');
      resolve();
    };
    u.onerror = (e) => {
      clearTimeout(watchdog);
      note('error', e.error);
      if (e.error === 'interrupted' || e.error === 'canceled') resolve();
      else reject(new Error(e.error));
    };

    if (synth.paused) synth.resume();
    if (synth.speaking || synth.pending) {
      // Что-то уже звучит: обрываем и говорим чуть позже (жест уже «разблокировал» звук).
      synth.cancel();
      setTimeout(() => synth.speak(u), 60);
    } else {
      synth.speak(u); // синхронно, внутри жеста пользователя
    }
  });
}

/**
 * Короткий тон через <audio> (не через Web Speech) — чтобы отличить
 * «нет звука вообще» от «не работает только озвучка».
 */
export function playBeep(): Promise<void> {
  const rate = 22050;
  const n = Math.floor(rate * 0.35);
  const buf = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  dv.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  str(36, 'data');
  dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const fade = Math.min(1, i / 400, (n - i) / 400);
    dv.setInt16(44 + i * 2, Math.sin((2 * Math.PI * 660 * i) / rate) * 0.4 * fade * 32767, true);
  }
  const audio = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
  note('beep');
  return audio.play();
}
