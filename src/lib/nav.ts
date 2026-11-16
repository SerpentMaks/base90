/** Переход по hash-маршруту. Если уже на этом адресе — экран всё равно перезапускается. */
export function navigate(to: string): void {
  if (window.location.hash === to) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = to;
}
