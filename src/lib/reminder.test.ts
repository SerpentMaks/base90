import { it, expect, describe } from "vitest";
import { reminderDecision, type ReminderStatus } from "./reminder";
const status: ReminderStatus = {
  studyDate: "2026-11-17",
  plannedMin: 20,
  activeMin: 0,
  minimumDone: false,
  dueCount: 23,
  streak: 7,
  freezes: 0,
  reminderTimes: ["10:00", "19:00"],
  lastCallTime: "22:00",
};
const at = (time: string) => new Date(`2026-11-17T${time}:00+03:00`);
describe("напоминания по Москве", () => {
  it("не шлёт ночью, до первого слота, в паузе и при полном плане", () => {
    expect(reminderDecision(at("23:10"), status, [])).toBeNull();
    expect(reminderDecision(at("07:59"), status, [])).toBeNull();
    expect(reminderDecision(at("09:59"), status, [])).toBeNull();
    expect(
      reminderDecision(at("10:23"), { ...status, paused: true }, []),
    ).toBeNull();
    expect(
      reminderDecision(
        at("10:23"),
        { ...status, pausedUntil: at("11:00").getTime() },
        [],
      ),
    ).toBeNull();
    expect(
      reminderDecision(at("19:23"), { ...status, activeMin: 20 }, []),
    ).toBeNull();
  });
  it("обычный слот не нужен после минимума, последний допустим", () => {
    expect(
      reminderDecision(at("19:23"), { ...status, minimumDone: true }, []),
    ).toBeNull();
    expect(
      reminderDecision(at("22:23"), { ...status, minimumDone: true }, [])?.slot,
    ).toBe("22:00");
  });
  it("опоздавший запуск выбирает последний слот и не дублируется", () => {
    expect(reminderDecision(at("20:23"), status, [])?.slot).toBe("19:00");
    expect(
      reminderDecision(at("20:23"), status, [
        { date: status.studyDate, slot: "19:00", at: "" },
      ]),
    ).toBeNull();
  });
  it("вчерашний выполненный план не глушит сегодняшний пуш", () => {
    expect(
      reminderDecision(
        at("10:23"),
        {
          ...status,
          studyDate: "2026-11-16",
          activeMin: 20,
          minimumDone: true,
        },
        [],
      ),
    ).not.toBeNull();
  });
  it("не более трёх; force — отдельный явный тест", () => {
    const sent = ["10:00", "19:00", "22:00"].map((slot) => ({
      date: status.studyDate,
      slot,
      at: "",
    }));
    expect(reminderDecision(at("22:23"), status, sent)).toBeNull();
    expect(
      reminderDecision(at("23:23"), { ...status, paused: true }, sent, true)
        ?.slot,
    ).toBe("test");
  });
});
