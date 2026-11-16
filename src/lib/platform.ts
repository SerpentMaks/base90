/** Открыто ли приложение с экрана «Домой» (без адресной строки). */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ притворяется Mac'ом, отличаем по тачу.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

/** Просим браузер не удалять данные сайта (iOS может чистить хранилище). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
