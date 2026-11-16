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

let silenceUrl: string | null = null;

/** 50 мс тишины (WAV 8 кГц, 8 бит). */
function silence(): string {
  if (silenceUrl) return silenceUrl;
  const n = 400;
  const buf = new Uint8Array(44 + n);
  const dv = new DataView(buf.buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  dv.setUint32(4, 36 + n, true);
  str(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, 8000, true);
  dv.setUint32(28, 8000, true);
  dv.setUint16(32, 1, true);
  dv.setUint16(34, 8, true);
  str(36, 'data');
  dv.setUint32(40, n, true);
  buf.fill(128, 44);
  silenceUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  return silenceUrl;
}

/**
 * «Разблокировать» звук на iOS: вызвать синхронно в обработчике тапа «Начать».
 * После этого общий <audio> можно запускать и без жеста (автоозвучка карточек).
 */
export function unlockAudio(): void {
  const a = player();
  if (a.dataset.unlocked) return;
  a.src = silence();
  a.play()
    .then(() => {
      a.dataset.unlocked = '1';
    })
    .catch(() => {});
  try {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
  } catch {
    /* нет синтеза — не страшно */
  }
}
