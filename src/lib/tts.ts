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

type VoiceLike = Pick<SpeechSynthesisVoice, 'name' | 'lang' | 'voiceURI' | 'localService'>;

export type VoiceQuality = 'premium' | 'enhanced' | 'standard' | 'basic' | 'robotic' | 'novelty';

/** Особое значение выбора: не задавать голос, пусть iOS возьмёт системный для en-US. */
export const SYSTEM_VOICE = '__system__';

/** «Голоса-приколы» Apple (звенят, булькают, поют) — никогда не выбираем. */
const NOVELTY = /^(bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|pipe organ)\b/i;
/** Голоса MacinTalk из 90-х: звучат как робот. */
const ROBOTIC = /^(albert|fred|junior|kathy|ralph|princess|vicki|victoria|bruce|agnes)\b/i;
/**
 * Eloquence: простой синтез, но заметно человечнее MacinTalk. С iOS 18 Safari часто отдаёт
 * сайтам ТОЛЬКО их (+ MacinTalk и «приколы»), без Samantha и без скачанных голосов.
 */
const ELOQUENCE = /^(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;
/** Порядок внутри Eloquence: чёткие взрослые голоса выше «бабушки/дедушки». */
const ELOQUENCE_ORDER = ['flo', 'reed', 'sandy', 'shelley', 'eddy', 'rocko', 'grandma', 'grandpa'];
/** Естественные голоса Apple/Google/Microsoft. */
const NATURAL = /^(samantha|ava|allison|susan|tom|zoe|evan|nathan|joelle|nicky|noelle|aaron|alex|siri|google us english|microsoft (aria|jenny|guy|ana|christopher|eric|michelle|roger|steffan))/i;

export function voiceQuality(v: VoiceLike): VoiceQuality {
  const id = `${v.name} ${v.voiceURI}`;
  if (NOVELTY.test(v.name)) return 'novelty';
  if (ROBOTIC.test(v.name)) return 'robotic';
  if (ELOQUENCE.test(v.name) || /eloquence/i.test(v.voiceURI)) return 'basic';
  if (/premium|премиум/i.test(id)) return 'premium';
  if (/enhanced|улучш|neural|natural|online/i.test(id)) return 'enhanced';
  return 'standard';
}

function voiceScore(v: VoiceLike): number {
  const quality = voiceQuality(v);
  const q = { premium: 40, enhanced: 30, standard: 20, basic: 0, robotic: -20, novelty: -100 }[quality];
  const eloq = quality === 'basic' ? ELOQUENCE_ORDER.findIndex((n) => v.name.toLowerCase().startsWith(n)) : -1;
  return q + (NATURAL.test(v.name) ? 5 : 0) + (/^samantha|^ava|^zoe/i.test(v.name) ? 2 : 0) + (eloq >= 0 ? (8 - eloq) / 10 : 0);
}

/** Американские голоса: лучшие первыми, «приколы» убраны (если есть хоть что-то другое). */
export function usVoices<V extends VoiceLike>(voices: V[] = voicesCache as unknown as V[]): V[] {
  const us = voices
    .filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('en-us'))
    .sort((a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name));
  const usable = us.filter((v) => voiceQuality(v) !== 'novelty');
  return usable.length ? usable : us;
}

const VOICE_KEY = 'base90.voiceURI';

/** Выбранный пользователем голос (до этапа 2 — в localStorage). */
export function getPreferredVoiceURI(): string | null {
  try {
    return localStorage.getItem(VOICE_KEY);
  } catch {
    return null;
  }
}

export function setPreferredVoiceURI(uri: string | null): void {
  try {
    if (uri) localStorage.setItem(VOICE_KEY, uri);
    else localStorage.removeItem(VOICE_KEY);
  } catch {
    /* приватный режим — просто не запоминаем */
  }
  listeners.forEach((fn) => fn());
}

export function usesSystemVoice(): boolean {
  return getPreferredVoiceURI() === SYSTEM_VOICE;
}

/** Голос, которым будем говорить: выбранный пользователем или лучший доступный; undefined — системный. */
export function currentVoice(): SpeechSynthesisVoice | undefined {
  if (usesSystemVoice()) return undefined;
  const list = usVoices(allVoices());
  const pref = getPreferredVoiceURI();
  return list.find((v) => v.voiceURI === pref) ?? list[0];
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
  const voice = opts.useDefaultVoice
    ? undefined
    : ((opts.voiceURI ? list.find((v) => v.voiceURI === opts.voiceURI) : undefined) ?? currentVoice());

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
