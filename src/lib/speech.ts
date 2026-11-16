/**
 * Единая точка озвучки: tts.speak(text). Сначала ищем запись нейроголосом
 * (сгенерирована при сборке), если её нет — синтез Safari (запасной вариант).
 * Вызывать прямо из обработчика тапа: и play(), и speechSynthesis.speak() — синхронно.
 */
import manifest from "../content/audio.json";
import { audioKey, audioPath } from "./audioKey";
import { playClip, stopClip } from "./audio";
import { getSettings } from "./settings";
import { speak as speakSafari } from "./tts";

const available: Record<string, Set<string>> = Object.fromEntries(
  Object.entries(manifest as Record<string, string[]>).map(([voice, keys]) => [
    voice,
    new Set(keys),
  ]),
);

export type SayOptions = { rate?: number; voice?: string };

export function hasRecording(
  text: string,
  voice: string = getSettings().narrator,
): boolean {
  return available[voice]?.has(audioKey(voice, text)) ?? false;
}

export function say(text: string, opts: SayOptions = {}): Promise<void> {
  const voice = opts.voice ?? getSettings().narrator;
  if (hasRecording(text, voice)) {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    return playClip(audioPath(voice, text), {
      rate: opts.rate ?? getSettings().speechRate,
    });
  }
  stopClip();
  return speakSafari(text, { rate: opts.rate ?? getSettings().speechRate });
}

export function stopSpeech(): void {
  stopClip();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
