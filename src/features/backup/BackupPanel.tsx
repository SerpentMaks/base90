import { useState, useEffect } from "react";
import {
  snapshot,
  encodeSnapshot,
  decodeSnapshot,
  applySnapshot,
  syncConfig,
  setSyncConfig,
  createGist,
  syncNow,
} from "../../lib/sync";
import { enablePush, testNotification } from "../../lib/push";
import { db } from "../../db/db";
import { panel } from "../../ui/Page";
export function BackupPanel() {
  const [subscriptionJson, setSubscriptionJson] = useState("");
  const [token, setToken] = useState(""),
    [gistId, setGistId] = useState(""),
    [connected, setConnected] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [times, setTimes] = useState({
    first: "10:00",
    second: "19:00",
    last: "22:00",
  });
  useEffect(() => {
    void syncConfig().then((c) => {
      setConnected(!!c);
      setGistId(c?.gistId ?? "");
    });
    void db.settings.get("reminders").then((r) => {
      const v = r?.value as
        { reminderTimes?: string[]; lastCallTime?: string } | undefined;
      if (v)
        setTimes({
          first: v.reminderTimes?.[0] ?? "10:00",
          second: v.reminderTimes?.[1] ?? "19:00",
          last: v.lastCallTime ?? "22:00",
        });
    });
  }, []);
  async function run(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      setMessage(success);
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Не получилось. Данные на устройстве сохранены.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className={panel}>
        <h2 className="font-semibold">Бэкап в файл</h2>
        <p className="text-sm text-muted my-2">
          Сохрани копию прогресса. Токены и записи микрофона в неё не входят.
          Импорт объединяет прогресс с текущим.
        </p>
        <button
          disabled={busy}
          className="min-h-12 w-full rounded-xl border border-line"
          onClick={() =>
            void run(async () => {
              const url = URL.createObjectURL(
                new Blob([await encodeSnapshot(await snapshot())], {
                  type: "application/json",
                }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = "base90-progress.json";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 10000);
            }, "Копия подготовлена к сохранению.")
          }
        >
          Экспорт прогресса
        </button>
        <label className="block mt-3 text-sm">
          Импорт копии
          <input
            type="file"
            accept=".json"
            disabled={busy}
            className="block mt-2 w-full"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f)
                void run(async () => {
                  await applySnapshot(await decodeSnapshot(await f.text()));
                }, "Прогресс объединён.");
              e.target.value = "";
            }}
          />
        </label>
      </section>
      <section className={panel}>
        <h2 className="font-semibold">Синхронизация с GitHub Gist</h2>
        <p className="my-2 text-sm text-muted">
          Секретный Gist хранит прогресс, чтобы продолжать на телефоне и ПК. Он
          доступен всем, у кого есть его ссылка. Создай отдельный classic token
          только с правом gist. Токен хранится на этом устройстве и даёт доступ
          к твоим гистам.
        </p>
        <a
          className="min-h-12 flex items-center text-accent underline"
          href="https://github.com/settings/tokens/new?scopes=gist&description=Base90"
          target="_blank"
          rel="noreferrer"
        >
          Создать токен с правом gist
        </a>
        {connected ? (
          <>
            <p className="text-sm break-all">
              Gist ID для второго устройства: {gistId}
            </p>
            <button
              disabled={busy}
              className="min-h-12 w-full text-accent"
              onClick={() => void run(syncNow, "Синхронизация завершена.")}
            >
              Синхронизировать сейчас
            </button>
            <button
              disabled={busy}
              className="min-h-12 w-full text-muted"
              onClick={() =>
                void run(async () => {
                  await setSyncConfig(null);
                  setConnected(false);
                }, "Синхронизация отключена, локальный прогресс сохранён.")
              }
            >
              Отключить
            </button>
          </>
        ) : (
          <>
            <label className="block text-sm mt-2">
              Токен
              <input
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="mt-1 min-h-12 w-full rounded-xl border border-line bg-bg px-3"
              />
            </label>
            <label className="block text-sm mt-3">
              ID существующего Gist (или оставь пустым)
              <input
                value={gistId}
                onChange={(e) => setGistId(e.target.value.trim())}
                className="mt-1 min-h-12 w-full rounded-xl border border-line bg-bg px-3"
              />
            </label>
            <button
              disabled={busy || !token}
              className="min-h-12 mt-3 w-full rounded-xl bg-accent text-accent-ink disabled:opacity-40"
              onClick={() =>
                void run(async () => {
                  const c = gistId
                    ? { token: token.trim(), gistId }
                    : await createGist(token.trim());
                  await setSyncConfig(c);
                  await syncNow();
                  setGistId(c.gistId);
                  setToken("");
                  setConnected(true);
                }, "Gist подключён.")
              }
            >
              Подключить
            </button>
          </>
        )}
      </section>
      <section className={panel}>
        <h2 className="font-semibold">Напоминания</h2>
        <p className="my-2 text-sm text-muted">
          На iPhone работают с иконки на экране «Домой». Для умных напоминаний
          подключи Gist и один раз укажи GIST_ID и GIST_TOKEN в секретах
          репозитория. Расписание GitHub может задерживаться.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(["first", "second", "last"] as const).map((key, i) => (
            <label className="text-xs" key={key}>
              {["Утро", "Вечер", "Последнее"][i]}
              <input
                type="time"
                value={times[key]}
                className="w-full min-h-12 rounded-lg border border-line bg-bg"
                onChange={(e) => setTimes({ ...times, [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <button
          className="min-h-12 text-accent w-full"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await db.settings.put({
                key: "reminders",
                value: {
                  reminderTimes: [times.first, times.second],
                  lastCallTime: times.last,
                },
                updatedAt: Date.now(),
              });
              await syncNow();
            }, "Время сохранено по Москве.")
          }
        >
          Сохранить время
        </button>
        <button
          disabled={busy}
          className="min-h-12 w-full border border-line rounded-xl"
          onClick={() =>
            void run(
              enablePush,
              "Подписка сохранена. Проверь настоящий пуш через GitHub Actions.",
            )
          }
        >
          Включить уведомления
        </button>
        <button
          disabled={busy}
          className="min-h-12 w-full text-accent"
          onClick={() =>
            void run(
              testNotification,
              "Локальная проверка отправлена. Настоящий пуш: GitHub → Actions → Напоминания Base90 → Run workflow → force.",
            )
          }
        >
          Проверить уведомление
        </button>
        <button
          disabled={busy}
          className="min-h-12 w-full text-muted"
          onClick={() =>
            void run(async () => {
              const old =
                ((await db.settings.get("reminders"))?.value as object) ?? {};
              await db.settings.put({
                key: "reminders",
                value: { ...old, pausedUntil: Date.now() + 3 * 86400000 },
                updatedAt: Date.now(),
              });
              await syncNow();
            }, "Напоминания на паузе на три дня.")
          }
        >
          Пауза на 3 дня
        </button>
        <details className="text-sm my-3">
          <summary className="min-h-12 flex items-center">
            Ручная настройка без Gist
          </summary>
          <p>
            Без Gist напоминания идут в 10:23, 19:23 и 22:23 МСК и не учитывают
            выполненный план. Сохрани подписку в секрете PUSH_SUBSCRIPTION
            репозитория.
          </p>
          <button
            className="min-h-12 text-accent"
            onClick={() =>
              void run(async () => {
                const sub = await (
                  await navigator.serviceWorker.ready
                ).pushManager.getSubscription();
                if (!sub) throw new Error("Сначала включи уведомления.");
                setSubscriptionJson(JSON.stringify(sub.toJSON()));
              }, "Подписка показана ниже. Храни её только в секрете репозитория. Не присылай её в публичные сообщения.")
            }
          >
            Показать подписку для секрета
          </button>
          {subscriptionJson && (
            <textarea
              aria-label="Личная подписка на уведомления"
              readOnly
              value={subscriptionJson}
              className="w-full h-32 p-2 bg-bg border border-line rounded-xl"
              onFocus={(e) => e.target.select()}
            />
          )}
        </details>
        <a
          className="text-sm underline text-accent"
          href="https://github.com/SerpentMaks/base90/settings/secrets/actions"
          target="_blank"
          rel="noreferrer"
        >
          Секреты GitHub Actions
        </a>
      </section>
      {message && (
        <p role="status" className={panel}>
          {message}
        </p>
      )}
    </>
  );
}
