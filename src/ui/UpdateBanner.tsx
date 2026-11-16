import { useRegisterSW } from 'virtual:pwa-register/react';

const HOUR = 60 * 60 * 1000;

/**
 * Новый Service Worker не активируется сам: показываем плашку,
 * чтобы не перезагружать приложение посреди упражнения.
 */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      setInterval(() => {
        if (navigator.onLine) reg.update().catch(() => {});
      }, HOUR);
    },
  });

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-lg"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
    >
      <p className="flex-1 text-sm">
        {needRefresh ? 'Доступно обновление' : 'Готово к работе без интернета'}
      </p>
      {needRefresh ? (
        <button
          className="min-h-12 rounded-xl bg-accent px-4 font-medium text-accent-ink"
          onClick={() => updateServiceWorker(true)}
        >
          Обновить
        </button>
      ) : null}
      <button
        className="min-h-12 rounded-xl px-3 text-muted"
        aria-label="Скрыть"
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
      >
        ✕
      </button>
    </div>
  );
}
