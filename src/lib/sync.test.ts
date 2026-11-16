import { describe, it, expect } from "vitest";
import { getScheduler, newFsrsCard, reviewFsrs, Rating } from "./fsrs";
import {
  mergeSnapshots,
  parseSnapshot,
  encodeSnapshot,
  decodeSnapshot,
  type Snapshot,
} from "./sync";
const empty = (): Snapshot => ({
  version: 1,
  cards: [],
  days: [],
  reviewLogs: [],
  progress: [],
  settings: [],
});
describe("снимки прогресса", () => {
  it("JSON-восстановление FSRS сохраняет Date и позволяет следующий ответ", async () => {
    const s = await getScheduler(0.9, false),
      now = new Date();
    const fresh = newFsrsCard(s, now);
    const reviewed = reviewFsrs(s, fresh, Rating.Good, now).card;
    const state = empty();
    state.cards = [
      {
        id: "listen:w_be",
        itemId: "w_be",
        kind: "listen",
        fsrs: reviewed,
        due: reviewed.dueAt.getTime(),
        availableAt: 0,
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      },
    ];
    const copy = await decodeSnapshot(JSON.stringify(state));
    expect(copy.cards[0]!.fsrs.dueAt).toBeInstanceOf(Date);
    expect(() =>
      reviewFsrs(
        s,
        copy.cards[0]!.fsrs,
        Rating.Good,
        new Date(now.getTime() + 600000),
      ),
    ).not.toThrow();
  });
  it("слияние коммутативно, идемпотентно и сохраняет разные записи", () => {
    const a = empty(),
      b = empty();
    a.progress = [
      { key: "lesson:a", value: 1, updatedAt: 10 },
      { key: "lesson:b", value: 1, updatedAt: 5 },
    ];
    b.progress = [{ key: "lesson:a", value: 2, updatedAt: 20 }];
    const merged = mergeSnapshots(a, b);
    expect(merged.progress).toHaveLength(2);
    expect(merged.progress[0]!.value).toBe(2);
    expect(merged).toEqual(mergeSnapshots(b, a));
    expect(mergeSnapshots(merged, merged)).toEqual(merged);
  });
  it("при равном времени результат не зависит от порядка устройств", () => {
    const a = empty(),
      b = empty();
    a.progress = [{ key: "a", value: 1, updatedAt: 1 }];
    b.progress = [{ key: "a", value: 2, updatedAt: 1 }];
    expect(mergeSnapshots(a, b)).toEqual(mergeSnapshots(b, a));
  });
  it("импорт отбрасывает реквизиты и локальную сессию, отвергает неверные типы", () => {
    const s = empty();
    s.settings = [{ key: "sync", value: { token: "secret" }, updatedAt: 0 }];
    s.progress = [{ key: "session", value: {}, updatedAt: 0 }];
    expect(parseSnapshot(s).settings).toEqual([]);
    expect(parseSnapshot(s).progress).toEqual([]);
    expect(() => parseSnapshot({ ...s, cards: [{ id: "broken" }] })).toThrow();
    expect(() => parseSnapshot({ ...s, version: 999 })).toThrow();
  });
  it("большой снимок проходит gzip и валидацию", async () => {
    const s = empty();
    s.progress = [{ key: "large", value: "x".repeat(510000), updatedAt: 1 }];
    const encoded = await encodeSnapshot(s);
    expect(encoded.length).toBeLessThan(5000);
    expect(await decodeSnapshot(encoded)).toEqual(s);
  });
});
