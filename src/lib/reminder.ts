import { moscowClock, studyDate } from "./time.ts";
export type ReminderStatus = {
  studyDate: string;
  plannedMin: number;
  activeMin: number;
  minimumDone: boolean;
  dueCount: number;
  streak: number;
  freezes: number;
  reminderTimes: string[];
  lastCallTime: string;
  quiet?: boolean;
  paused?: boolean;
  pausedUntil?: number;
};
export type SentEntry = { date: string; slot: string; at: string };
export function reminderDecision(
  now: Date,
  status: ReminderStatus | null,
  sent: SentEntry[],
  force = false,
): { slot: string; body: string } | null {
  if (force)
    return {
      slot: "test",
      body: "Тест Base90: уведомления работают. Можно начать с пяти минут.",
    };
  const clock = moscowClock(now);
  const today = studyDate(now);
  if (
    clock.hour < 8 ||
    clock.hour >= 23 ||
    status?.quiet ||
    status?.paused ||
    (status?.pausedUntil ?? 0) > now.getTime()
  )
    return null;
  const fresh = status?.studyDate === today;
  const entries = sent.filter((s) => s.date === today && s.slot !== "test");
  if (
    entries.length >= 3 ||
    (fresh && status && status.activeMin >= status.plannedMin)
  )
    return null;
  const slots = [
    ...(status?.reminderTimes ?? ["10:00", "19:00"]),
    status?.lastCallTime ?? "22:00",
  ]
    .filter((s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s))
    .filter((s) => s >= "08:00" && s < "23:00");
  const minute = clock.hour * 60 + clock.minute;
  // Берём один ближайший прошедший слот; не догоняем все пропущенные пуши.
  const slot = [...new Set(slots)]
    .sort()
    .reverse()
    .find((s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3)) <= minute);
  if (!slot || entries.some((s) => s.slot === slot)) return null;
  const last = slot === (status?.lastCallTime ?? "22:00");
  if (fresh && status?.minimumDone && !last) return null;
  const due = fresh ? (status?.dueCount ?? 0) : 0;
  const planned = status?.plannedMin ?? 20;
  const body = last
    ? (status?.freezes ?? 0) > 0
      ? "Можно отдохнуть — заморозка спасёт серию. А пять минут повторений будут кстати."
      : `Твоя серия — ${status?.streak ?? 0} дней. Десяти минут хватит, чтобы сохранить её.`
    : due > 0
      ? `${due} карточек ждут повторения — примерно ${Math.max(1, Math.round(due * 0.35))} минут.`
      : `Сегодня ${planned} минут. Начнём с небольшого подхода?`;
  return { slot, body };
}
