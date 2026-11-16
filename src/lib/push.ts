import { db, uuid } from "../db/db";
import {
  readGistFile,
  writeGistFiles,
  syncConfig,
  statusSnapshot,
} from "./sync";
type Devices = {
  devices: Record<
    string,
    { subscription: PushSubscriptionJSON; expired?: boolean }
  >;
};
export function pushSupport() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}
export async function saveSubscription(sub: PushSubscription) {
  if (!(await syncConfig()))
    throw Error("Сначала подключи синхронизацию с Gist.");
  let id = (await db.progress.get("device"))?.value as string | undefined;
  if (!id) {
    id = uuid();
    await db.progress.put({ key: "device", value: id, updatedAt: Date.now() });
  }
  const data = ((await readGistFile(
    "push-subscription.json",
  )) as Devices | null) ?? { devices: {} };
  data.devices[id] = { subscription: sub.toJSON(), expired: false };
  await writeGistFiles({
    "push-subscription.json": { content: JSON.stringify(data) },
    "status.json": { content: JSON.stringify(await statusSnapshot()) },
  });
  await db.progress.delete("private:pushError");
  await db.settings.put({
    key: "push",
    value: { enabled: true },
    updatedAt: Date.now(),
  });
}
export async function enablePush() {
  if (!pushSupport())
    throw Error(
      "На iPhone открой приложение с иконки на экране «Домой» (iOS 16.4 или новее).",
    );
  // Запрос вызывается непосредственно обработчиком нажатия, до первой асинхронной операции.
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw Error(
      "Разрешение не выдано. Проверь настройки уведомлений для Base90.",
    );
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!key) throw Error("Ключ уведомлений ещё не настроен в сборке.");
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const raw = atob(key.replace(/-/g, "+").replace(/_/g, "/"));
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)),
    }));
  if (await syncConfig()) await saveSubscription(sub);
  else
    await db.settings.put({
      key: "push",
      value: { enabled: true },
      updatedAt: Date.now(),
    });
  await db.progress.delete("private:pushError");
  return sub;
}
export async function renewPush() {
  if (
    !pushSupport() ||
    Notification.permission !== "granted" ||
    !(await db.settings.get("push"))
  )
    return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (await syncConfig()) {
    const data = (await readGistFile(
      "push-subscription.json",
    )) as Devices | null;
    const id = (await db.progress.get("device"))?.value as string | undefined;
    if (sub && id && data?.devices[id]?.expired) {
      await sub.unsubscribe();
      await enablePush();
      return;
    }
    if (sub) await saveSubscription(sub);
    else await enablePush();
  } else if (!sub)
    throw new Error(
      "Подписка истекла. Включи уведомления и обнови секрет PUSH_SUBSCRIPTION.",
    );
}
export async function testNotification() {
  if (!pushSupport() || Notification.permission !== "granted")
    throw Error("Сначала включи уведомления.");
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification("Base90", {
    body: "Локальная проверка: уведомления разрешены.",
    icon: import.meta.env.BASE_URL + "icons/icon-192.png",
    data: { url: reg.scope + "#/today" },
  });
}
