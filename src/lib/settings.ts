/**
 * Настройки: живут в Dexie (таблица settings), а в памяти — синхронная копия,
 * чтобы озвучка могла читать их прямо в обработчике тапа (iOS).
 */
import { useSyncExternalStore } from "react";
import { db } from "../db/db";

export type Settings = {
  /** Желаемая удерживаемость FSRS, 0.85–0.95. */
  retention: number;
  /** Озвучивать английский автоматически при показе. */
  autoplay: boolean;
  /** Показывать транскрипцию (IPA). */
  showIpa: boolean;
  /** Голос нейроозвучки (записи). */
  narrator: "af_heart";
  speechRate: number;
  /** Запасной голос Safari: voiceURI, '__system__' или null (лучший доступный). */
  safariVoiceURI: string | null;
  /** Бюджет времени (§4.1). */
  time: { start: number; step: number; period: number; cap: number };
};

export const DEFAULT_SETTINGS: Settings = {
  retention: 0.9,
  autoplay: true,
  showIpa: true,
  narrator: "af_heart",
  speechRate: 1,
  safariVoiceURI: null,
  time: { start: 20, step: 10, period: 3, cap: 90 },
};

let current: Settings = DEFAULT_SETTINGS;
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return current;
}

export async function loadSettings(): Promise<Settings> {
  try {
    const row = await db.settings.get("main");
    const saved = (row?.value as Partial<Settings>) ?? {};
    current = {
      ...DEFAULT_SETTINGS,
      ...saved,
      time: { ...DEFAULT_SETTINGS.time, ...saved.time },
    };
    // Миграция с версии 0.1.x: голос Safari хранился в localStorage.
    try {
      const legacy = localStorage.getItem("base90.voiceURI");
      if (legacy && !row) current = { ...current, safariVoiceURI: legacy };
      localStorage.removeItem("base90.voiceURI");
      localStorage.removeItem("base90.neuralVoice");
    } catch {
      /* нет localStorage — ничего страшного */
    }
  } catch {
    current = DEFAULT_SETTINGS; // IndexedDB недоступна (приватный режим) — работаем на значениях по умолчанию
  }
  listeners.forEach((fn) => fn());
  return current;
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  current = { ...current, ...patch };
  listeners.forEach((fn) => fn());
  await db.settings.put({ key: "main", value: current, updatedAt: Date.now() });
}

export function subscribeSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings);
}
