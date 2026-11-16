/**
 * Имя аудиофайла для текста: одинаково считается в браузере и в скрипте генерации.
 * cyrb53 — быстрый синхронный хеш (crypto.subtle асинхронный, а play() должен
 * вызываться синхронно в жесте пользователя).
 */
export function normalizeSpeechText(text: string): string {
  return text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
}

function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

export function audioKey(voice: string, text: string): string {
  return cyrb53(`${voice}|${normalizeSpeechText(text)}`).slice(0, 14);
}

export function audioPath(voice: string, text: string): string {
  return `audio/${voice}/${audioKey(voice, text)}.m4a`;
}
