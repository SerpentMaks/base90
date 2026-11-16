import * as webpush from "web-push";
import {
  reminderDecision,
  type ReminderStatus,
  type SentEntry,
} from "../src/lib/reminder.ts";
import { studyDate, moscowClock } from "../src/lib/time.ts";
const env = process.env;
if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY || !env.VAPID_SUBJECT) {
  console.log("Напоминания ещё не настроены: нужны VAPID-секреты.");
  process.exit(0);
}
webpush.setVapidDetails(
  env.VAPID_SUBJECT,
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY,
);
const now = new Date();
const force = env.FORCE === "true";
type Device = { subscription: webpush.PushSubscription; expired?: boolean };
let status: ReminderStatus | null = null;
let sent: SentEntry[] = [];
let devices: Record<string, Device> = {};
async function gist(method = "GET", body?: unknown) {
  const r = await fetch(`https://api.github.com/gists/${env.GIST_ID}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env.GIST_TOKEN}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw Error(`Gist API: ${r.status}`);
  return r.json() as Promise<{
    public: boolean;
    files: Record<string, { content?: string; truncated?: boolean }>;
  }>;
}
if (env.GIST_ID && env.GIST_TOKEN) {
  const g = await gist();
  if (g.public) throw Error("Нужен секретный Gist");
  const read = <T>(name: string, fallback: T): T => {
    const file = g.files[name];
    if (file?.truncated) throw Error("Файл Gist обрезан: " + name);
    return file?.content ? (JSON.parse(file.content) as T) : fallback;
  };
  status = read<ReminderStatus | null>("status.json", null);
  sent = read("sent-log.json", []);
  devices = read("push-subscription.json", { devices: {} } as {
    devices: Record<string, Device>;
  }).devices;
} else if (env.PUSH_SUBSCRIPTION) {
  devices = {
    manual: {
      subscription: JSON.parse(
        env.PUSH_SUBSCRIPTION,
      ) as webpush.PushSubscription,
    },
  };
} else {
  console.log("Нет подписок. Подключи Gist в приложении и включи уведомления.");
  process.exit(0);
}
if (!env.GIST_ID && !force && ![10, 19, 22].includes(moscowClock(now).hour)) {
  console.log("Ручная подписка: фиксированные часы 10, 19, 22 МСК.");
  process.exit(0);
}
const decision = reminderDecision(now, status, sent, force);
if (!decision) {
  console.log("Отправка не нужна: слот, пауза или выполненный план.");
  process.exit(0);
}
let delivered = 0,
  failures = 0;
for (const [id, device] of Object.entries(devices)) {
  if (device.expired) continue;
  try {
    await webpush.sendNotification(
      device.subscription,
      JSON.stringify({
        title: "Base90",
        body: decision.body,
        url: "/base90/#/today",
        badge: status?.studyDate === studyDate(now) ? status.dueCount : 0,
      }),
      { TTL: 3600 },
    );
    delivered++;
  } catch (error) {
    const code = (error as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) {
      device.expired = true;
      console.log("Истёкшая подписка удалена из рассылки:", id);
    } else {
      failures++;
      console.error("Push вернул ошибку:", code ?? "network");
    }
  }
}
if (env.GIST_ID && env.GIST_TOKEN) {
  if (delivered)
    sent.push({
      date: studyDate(now),
      slot: decision.slot,
      at: now.toISOString(),
    });
  sent = sent.filter((s) => Date.parse(s.date) > now.getTime() - 7 * 86400000);
  await gist("PATCH", {
    files: {
      "sent-log.json": { content: JSON.stringify(sent) },
      "push-subscription.json": { content: JSON.stringify({ devices }) },
    },
  });
}
console.log(`Отправлено: ${delivered}, временных ошибок: ${failures}`);
if (failures) process.exitCode = 1;
