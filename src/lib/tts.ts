/**
 * Озвучка через Web Speech API. Абстракция speak(), чтобы позже можно было
 * подменить на заранее сгенерированные аудиофайлы.
 * На iOS звук разрешён только после жеста пользователя.
 */
export type SpeakOptions = { rate?: number; voiceURI?: string };

let voicesCache: SpeechSynthesisVoice[] = [];

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Голоса грузятся асинхронно: ждём voiceschanged (не дольше timeoutMs). */
export function loadVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported()) return Promise.resolve([]);
  const now = speechSynthesis.getVoices();
  if (now.length) return Promise.resolve((voicesCache = now));
  return new Promise((resolve) => {
    const done = () => {
      speechSynthesis.removeEventListener('voiceschanged', done);
      clearTimeout(timer);
      resolve((voicesCache = speechSynthesis.getVoices()));
    };
    const timer = setTimeout(done, timeoutMs);
    speechSynthesis.addEventListener('voiceschanged', done);
  });
}

/** Американские голоса, «улучшенные» системные — первыми. */
export function usVoices(voices: SpeechSynthesisVoice[] = voicesCache): SpeechSynthesisVoice[] {
  const score = (v: SpeechSynthesisVoice) =>
    (/enhanced|premium|neural|natural/i.test(v.name) ? 2 : 0) + (v.localService ? 1 : 0);
  return voices
    .filter((v) => v.lang.replace('_', '-').startsWith('en-US'))
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
}

export async function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!ttsSupported()) throw new Error('no-tts');
  const voices = voicesCache.length ? voicesCache : await loadVoices();
  const list = usVoices(voices);
  const voice = list.find((v) => v.voiceURI === opts.voiceURI) ?? list[0];
  speechSynthesis.cancel();
  return new Promise((resolve, reject) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    if (voice) u.voice = voice;
    u.rate = opts.rate ?? 1;
    u.onend = () => resolve();
    u.onerror = (e) => (e.error === 'interrupted' || e.error === 'canceled' ? resolve() : reject(new Error(e.error)));
    speechSynthesis.speak(u);
  });
}
