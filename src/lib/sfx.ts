/** Короткие звуки «верно / неверно» (Web Audio). Тихо и коротко, без файлов. */
let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, gain = 0.08) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.02);
}

/** Вызвать в жесте пользователя (кнопка «Начать»), иначе iOS не даст играть звук. */
export function unlockSfx(): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function sfxCorrect(): void {
  tone(660, 0, 0.12);
  tone(880, 0.09, 0.16);
}

export function sfxWrong(): void {
  tone(220, 0, 0.22, 0.06);
}
