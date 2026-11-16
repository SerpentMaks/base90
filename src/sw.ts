/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope;

// Прекэш всего приложения и контента → полная работа офлайн.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Любая навигация внутри scope (например, с ?query) → index.html из кэша.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Новый SW ждёт, пока пользователь не нажмёт «Обновить».
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') void self.skipWaiting();
});
clientsClaim();

type PushPayload = { title?: string; body?: string; url?: string; badge?: number };

// iOS требует показывать видимое уведомление на КАЖДЫЙ пуш.
self.addEventListener('push', (event) => {
  let data: PushPayload = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  const scope = self.registration.scope;
  const url = data.url ?? `${scope}#/today`;
  const tasks: Promise<unknown>[] = [
    self.registration.showNotification(data.title ?? 'Base90', {
      body: data.body ?? 'Пора позаниматься английским',
      icon: `${scope}icons/icon-192.png`,
      badge: `${scope}icons/icon-192.png`,
      data: { url },
      tag: 'base90-reminder',
    }),
  ];
  const nav = self.navigator as WorkerNavigator & { setAppBadge?: (n?: number) => Promise<void> };
  if (typeof data.badge === 'number' && nav.setAppBadge) tasks.push(nav.setAppBadge(data.badge).catch(() => {}));
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data as { url?: string } | null)?.url ?? '#/today', self.registration.scope).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        if (c.url.startsWith(self.registration.scope)) {
          await c.focus();
          if ('navigate' in c) await (c as WindowClient).navigate(target).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
