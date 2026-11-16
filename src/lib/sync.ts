import { z } from "zod";
import { db } from "../db/db";
import type { CardRow, DayRow, KvRow, ReviewLogRow } from "../db/db";
import { loadSettings } from "./settings";
import { dailyPlan } from "./study";
import { repo } from "../db/repo";
import { studyDate } from "./time";
import { loadPersonalWords } from "./personalWords";
import { wordSchema } from "../content/schema";

const num = z.number().finite().nonnegative();
const kv = z.object({ key: z.string(), value: z.unknown(), updatedAt: num });
const card = z.object({
  id: z.string(),
  itemId: z.string(),
  kind: z.enum([
    "listen",
    "produce",
    "cloze",
    "grammar",
    "pair",
    "speech",
    "dictation",
    "shadow",
  ]),
  due: num,
  availableAt: num,
  createdAt: num,
  updatedAt: num,
  suspended: z.union([z.literal(0), z.literal(1)]).optional(),
  fsrs: z
    .object({
      stability: num,
      difficulty: num,
      state: z.number().int().min(0).max(3),
      scheduleStatus: z.enum(["new", "learning", "review", "relearning"]),
      dueAt: z.coerce.date(),
      lastReviewAt: z.coerce.date().nullable(),
      cardId: z.string(),
      reps: num,
      lapses: num,
      scheduledDays: num,
      learningStep: num,
    })
    .passthrough(),
});
const snapshotSchema = z.object({
  version: z.literal(1),
  cards: z.array(card),
  days: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      plannedMin: num,
      activeMin: num,
      counted: z.union([z.literal(0), z.literal(1)]),
      newIntroduced: num,
      reviewsDone: num,
      updatedAt: num,
    }),
  ),
  reviewLogs: z.array(
    z.object({
      id: z.string(),
      cardId: z.string(),
      itemId: z.string(),
      kind: card.shape.kind,
      rating: z.number().int().min(1).max(4),
      stateBefore: z.number().int().min(0).max(3),
      reviewedAt: num,
      studyDate: z.string(),
      elapsedMs: num,
      exerciseType: z.string(),
    }),
  ),
  progress: z.array(kv),
  settings: z.array(kv),
});
export type Snapshot = {
  version: 1;
  cards: CardRow[];
  days: DayRow[];
  reviewLogs: ReviewLogRow[];
  progress: KvRow[];
  settings: KvRow[];
};
const portable = (r: KvRow) =>
  !["session", "sync", "device", "push", "sync-pending"].includes(r.key) &&
  !r.key.startsWith("private:");
export function parseSnapshot(value: unknown): Snapshot {
  const result = snapshotSchema.parse(value) as Snapshot;
  // Ни импорт, ни удалённый снимок не могут подменить локальные реквизиты.
  result.settings = result.settings.filter((r) =>
    ["main", "reminders"].includes(r.key),
  );
  result.progress = result.progress.filter(portable);
  for (const row of result.progress) {
    if (row.key.startsWith("personalWord:")) {
      const item = wordSchema.parse(row.value);
      if (
        !item.id.startsWith("w_personal_") ||
        !item.tags?.includes("personal")
      )
        throw new Error("Неверное личное слово");
      row.value = item;
    }
    if (row.key.startsWith("test:"))
      row.value = z
        .object({ correct: num, total: num, at: num })
        .parse(row.value);
    if (row.key.startsWith("reader-position:"))
      row.value = z
        .object({ index: z.number().int().nonnegative() })
        .parse(row.value);
  }
  for (const row of result.settings) {
    if (row.key === "reminders") {
      row.value = z
        .object({
          reminderTimes: z
            .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/))
            .max(2)
            .optional(),
          lastCallTime: z
            .string()
            .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
            .optional(),
          quiet: z.boolean().optional(),
          paused: z.boolean().optional(),
          pausedUntil: num.optional(),
        })
        .parse(row.value);
      continue;
    }

    row.value = z
      .object({
        retention: z.number().min(0.85).max(0.95).optional(),
        autoplay: z.boolean().optional(),
        showIpa: z.boolean().optional(),
        narrator: z.literal("af_heart").optional(),
        safariVoiceURI: z.string().nullable().optional(),
        speechRate: z.number().min(0.75).max(1.25).optional(),
        time: z
          .object({
            start: z.number().min(5).max(180),
            step: z.number().min(0).max(30),
            period: z.number().int().min(1).max(30),
            cap: z.number().min(5).max(180),
          })
          .optional(),
      })
      .parse(row.value);
    const s = row.value as Record<string, unknown>;
    if (!s || typeof s !== "object") throw new Error("Некорректные настройки");
    const t = s.time as Record<string, number> | undefined;
    if (
      t &&
      (!Number.isFinite(t.start) ||
        t.start! < 5 ||
        t.start! > 180 ||
        !Number.isFinite(t.step) ||
        t.step! < 0 ||
        t.step! > 30 ||
        !Number.isFinite(t.period) ||
        t.period! < 1 ||
        t.period! > 30 ||
        !Number.isFinite(t.cap) ||
        t.cap! < t.start! ||
        t.cap! > 180)
    )
      throw new Error("Некорректный бюджет времени");
    if (
      s.retention !== undefined &&
      (typeof s.retention !== "number" ||
        s.retention < 0.85 ||
        s.retention > 0.95)
    )
      throw new Error("Некорректная удерживаемость");
  }
  return result;
}
function mergeRows<T extends { updatedAt: number }>(
  a: T[],
  b: T[],
  key: (r: T) => string,
): T[] {
  const m = new Map<string, T>();
  for (const row of [...a, ...b]) {
    const previous = m.get(key(row));
    if (
      !previous ||
      row.updatedAt > previous.updatedAt ||
      (row.updatedAt === previous.updatedAt &&
        JSON.stringify(row) > JSON.stringify(previous))
    )
      m.set(key(row), row);
  }
  return [...m.values()].sort((a, b) => key(a).localeCompare(key(b)));
}
export function mergeSnapshots(a: Snapshot, b: Snapshot): Snapshot {
  const logs = new Map<string, ReviewLogRow>();
  for (const l of [...a.reviewLogs, ...b.reviewLogs]) {
    const old = logs.get(l.id);
    if (!old || JSON.stringify(l) > JSON.stringify(old)) logs.set(l.id, l);
  }
  return {
    version: 1,
    cards: mergeRows(a.cards, b.cards, (r) => r.id),
    days: mergeRows(a.days, b.days, (r) => r.date),
    reviewLogs: [...logs.values()].sort((a, b) => a.id.localeCompare(b.id)),
    progress: mergeRows(
      a.progress.filter(portable),
      b.progress.filter(portable),
      (r) => r.key,
    ),
    settings: mergeRows(
      a.settings.filter((r) => ["main", "reminders"].includes(r.key)),
      b.settings.filter((r) => ["main", "reminders"].includes(r.key)),
      (r) => r.key,
    ),
  };
}
export async function snapshot(): Promise<Snapshot> {
  return db.transaction(
    "r",
    [db.cards, db.days, db.reviewLogs, db.progress, db.settings],
    async () => ({
      version: 1,
      cards: await db.cards.toArray(),
      days: await db.days.toArray(),
      reviewLogs: await db.reviewLogs.toArray(),
      progress: (await db.progress.toArray()).filter(portable),
      settings: (await db.settings.toArray()).filter((r) =>
        ["main", "reminders"].includes(r.key),
      ),
    }),
  );
}
export async function applySnapshot(s: Snapshot) {
  await db.transaction(
    "rw",
    [db.cards, db.days, db.reviewLogs, db.progress, db.settings],
    async () => {
      const merged = mergeSnapshots(await snapshot(), s);
      await db.cards.bulkPut(merged.cards);
      await db.days.bulkPut(merged.days);
      await db.reviewLogs.bulkPut(merged.reviewLogs);
      await db.progress.bulkPut(merged.progress);
      await db.settings.bulkPut(merged.settings);
    },
  );
  await loadPersonalWords();
  await loadSettings();
  window.dispatchEvent(new Event("sync-update"));
}
export async function encodeSnapshot(s: Snapshot): Promise<string> {
  const json = JSON.stringify(s);
  if (json.length < 500_000 || !("CompressionStream" in globalThis))
    return json;
  const bytes = new Uint8Array(
    await new Response(
      new Blob([json]).stream().pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer(),
  );
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return JSON.stringify({ encoding: "gzip-base64", data: btoa(binary) });
}
export async function decodeSnapshot(text: string): Promise<Snapshot> {
  if (text.length > 20_000_000) throw new Error("Файл слишком большой");
  let data: unknown = JSON.parse(text);
  if (
    data &&
    typeof data === "object" &&
    "encoding" in data &&
    data.encoding === "gzip-base64"
  ) {
    const raw = atob(z.object({ data: z.string() }).parse(data).data);
    if (typeof DecompressionStream === "undefined")
      throw new Error(
        "Этот браузер не поддерживает сжатую копию. Обнови браузер или импортируй несжатый экспорт.",
      );
    const stream = new Blob([Uint8Array.from(raw, (c) => c.charCodeAt(0))])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    const reader = stream.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 30_000_000) {
        await reader.cancel();
        throw new Error("Слишком большой снимок");
      }
      chunks.push(value);
    }
    data = JSON.parse(await new Blob(chunks as BlobPart[]).text());
  }
  return parseSnapshot(data);
}
export type SyncConfig = { token: string; gistId: string };
export async function syncConfig(): Promise<SyncConfig | null> {
  return ((await db.settings.get("sync"))?.value as SyncConfig | null) ?? null;
}
export async function setSyncConfig(c: SyncConfig | null) {
  if (c)
    await db.settings.put({ key: "sync", value: c, updatedAt: Date.now() });
  else await db.settings.delete("sync");
}
function requestTimeout(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}
async function api(path: string, config: SyncConfig, init: RequestInit = {}) {
  const r = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: requestTimeout(30_000),
  });
  if (!r.ok)
    throw new Error(
      r.status === 401 || r.status === 403
        ? "GitHub отклонил токен. Проверь срок и право gist."
        : `GitHub: ошибка ${r.status}`,
    );
  return r;
}
export async function createGist(token: string): Promise<SyncConfig> {
  const r = await api(
    "/gists",
    { token, gistId: "" },
    {
      method: "POST",
      body: JSON.stringify({
        public: false,
        description: "Base90 — личный прогресс",
        files: {
          "progress.json": { content: await encodeSnapshot(await snapshot()) },
        },
      }),
    },
  );
  return { token, gistId: ((await r.json()) as { id: string }).id };
}
type Gist = {
  public: boolean;
  files: Record<
    string,
    { content?: string; truncated?: boolean; raw_url?: string }
  >;
};
export async function readGistFile(name: string): Promise<unknown | null> {
  const c = await syncConfig();
  if (!c) return null;
  const r = await api(`/gists/${c.gistId}`, c);
  const g = (await r.json()) as Gist;
  if (g.public) throw new Error("Для подписки нужен секретный Gist");
  const t = await gistText(g, name, c);
  return t ? JSON.parse(t) : null;
}
async function gistText(
  g: Gist,
  filename: string,
  c: SyncConfig,
): Promise<string | null> {
  const f = g.files[filename];
  if (!f) return null;
  if (!f.truncated) return f.content ?? null;
  if (!f.raw_url) throw new Error("GitHub обрезал снимок");
  const url = new URL(f.raw_url);
  if (url.origin !== "https://gist.githubusercontent.com")
    throw new Error("Неверный адрес снимка");
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${c.token}` },
    signal: requestTimeout(30_000),
  });
  if (!r.ok) throw new Error("Не удалось загрузить полный снимок");
  return r.text();
}
export async function writeGistFiles(
  files: Record<string, { content: string }>,
  config?: SyncConfig,
) {
  const c = config ?? (await syncConfig());
  if (!c) throw new Error("Сначала подключи Gist");
  await api(`/gists/${c.gistId}`, c, {
    method: "PATCH",
    body: JSON.stringify({ files }),
  });
}
export async function statusSnapshot() {
  const p = await dailyPlan();
  const reminders = (await db.settings.get("reminders"))?.value as
    Record<string, unknown> | undefined;
  return {
    updatedAt: new Date().toISOString(),
    studyDate: studyDate(),
    plannedMin: p.minutes,
    activeMin: p.activeMin,
    minimumDone:
      p.activeMin >= 10 ||
      (await db.progress.get(`minimum:${studyDate()}`))?.value === true,
    dueCount: await repo().dueCount(),
    streak: p.streak.count,
    freezes: p.streak.freezes,
    reminderTimes: ["10:00", "19:00"],
    lastCallTime: "22:00",
    quiet: false,
    paused: false,
    ...reminders,
  };
}
let inFlight: Promise<void> | null = null;
export function syncNow(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = runSync().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
async function runSync() {
  const c = await syncConfig();
  if (!c) return;
  if (!/^[a-f0-9]{20,40}$/i.test(c.gistId)) throw new Error("Неверный ID Gist");
  const r = await api(`/gists/${c.gistId}`, c);
  const gist = (await r.json()) as Gist;
  if (gist.public)
    throw new Error(
      "Выбран публичный Gist. Создай секретный для личного прогресса.",
    );
  const remote = await gistText(gist, "progress.json", c);
  if ((await syncConfig())?.gistId !== c.gistId) return;
  if (remote) await applySnapshot(await decodeSnapshot(remote));
  // Снимаем данные ПОСЛЕ сетевого запроса, чтобы включить ответы, сделанные во время синхронизации.
  await writeGistFiles(
    {
      "progress.json": { content: await encodeSnapshot(await snapshot()) },
      "status.json": { content: JSON.stringify(await statusSnapshot()) },
    },
    c,
  );
  await db.progress.put({
    key: "private:lastSync",
    value: Date.now(),
    updatedAt: Date.now(),
  });
  await db.progress.delete("sync-pending");
}
export function startAutoSync() {
  const run = () => {
    void syncNow().catch(async () => {
      await db.progress.put({
        key: "sync-pending",
        value: true,
        updatedAt: Date.now(),
      });
    });
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const change = () => {
    clearTimeout(timer);
    timer = setTimeout(run, 5000);
  };
  const visibility = () => {
    if (document.visibilityState === "hidden") run();
  };
  window.addEventListener("online", run);
  window.addEventListener("study-update", change);
  document.addEventListener("visibilitychange", visibility);
  run();
  return () => {
    clearTimeout(timer);
    window.removeEventListener("online", run);
    window.removeEventListener("study-update", change);
    document.removeEventListener("visibilitychange", visibility);
  };
}
