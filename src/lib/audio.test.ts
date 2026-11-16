import { it, expect, vi, afterEach } from "vitest";
afterEach(() => {
  vi.unstubAllGlobals();
});
it("новая запись завершает старое ожидание, а ошибка старого play не отменяет новую", async () => {
  vi.resetModules();
  let rejectOld: (error: Error) => void = () => {};
  let count = 0;
  class FakeAudio extends EventTarget {
    src = "";
    preload = "";
    playbackRate = 1;
    preservesPitch = true;
    dataset = {};
    pause() {}
    play() {
      count++;
      return count === 1
        ? new Promise<void>((_, reject) => {
            rejectOld = reject;
          })
        : Promise.resolve();
    }
  }
  const a = new FakeAudio();
  vi.stubGlobal(
    "Audio",
    class {
      constructor() {
        return a;
      }
    },
  );
  const { playClip } = await import("./audio");
  const old = playClip("one.m4a");
  const next = playClip("two.m4a");
  await expect(old).resolves.toBeUndefined();
  rejectOld(new Error("interrupted"));
  await Promise.resolve();
  a.dispatchEvent(new Event("ended"));
  await expect(next).resolves.toBeUndefined();
});
it("пауза освобождает ожидание конца записи", async () => {
  vi.resetModules();
  class FakeAudio extends EventTarget {
    src = "";
    preload = "";
    playbackRate = 1;
    preservesPitch = true;
    dataset = {};
    pause() {}
    play() {
      return Promise.resolve();
    }
  }
  vi.stubGlobal("Audio", FakeAudio);
  const { playClip, stopClip } = await import("./audio");
  const pending = playClip("test.m4a");
  stopClip();
  await expect(pending).resolves.toBeUndefined();
});
