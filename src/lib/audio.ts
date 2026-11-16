/**
 * Проигрывание заранее записанных аудиофайлов (нейроголос, сгенерирован при сборке).
 * Один переиспользуемый <audio>: на iOS элемент, «разблокированный» жестом, потом
 * можно запускать без жеста. play() вызывается синхронно — можно прямо из onClick.
 */
let el: HTMLAudioElement | null = null;

function player(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.preload = 'auto';
    (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
  }
  return el;
}

export type ClipOptions = { rate?: number };

/** Полный URL файла внутри приложения (учитывает base-путь /base90/). */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}

export function playClip(path: string, opts: ClipOptions = {}): Promise<void> {
  const a = player();
  a.pause();
  a.src = assetUrl(path);
  a.playbackRate = opts.rate ?? 1;
  a.preservesPitch = true;
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      a.onended = null;
      a.onerror = null;
    };
    a.onended = () => {
      cleanup();
      resolve();
    };
    a.onerror = () => {
      cleanup();
      reject(new Error('audio-error'));
    };
    a.play().catch((e: unknown) => {
      cleanup();
      reject(e instanceof Error ? e : new Error(String(e)));
    });
  });
}

export function stopClip(): void {
  el?.pause();
}
