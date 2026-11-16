/**
 * Время по Москве (UTC+3, без перевода часов) и «учебные сутки» с границей в 04:00:
 * занятие в 01:00 засчитывается во вчерашний день.
 */
export const MOSCOW_OFFSET_MIN = 180;
export const DAY_BOUNDARY_HOUR = 4;

const MS_PER_MIN = 60_000;
const MS_PER_DAY = 86_400_000;

/** Учебная дата YYYY-MM-DD (Москва, граница суток 04:00). */
export function studyDate(at: Date = new Date()): string {
  const shifted = new Date(at.getTime() + (MOSCOW_OFFSET_MIN - DAY_BOUNDARY_HOUR * 60) * MS_PER_MIN);
  return shifted.toISOString().slice(0, 10);
}

/** Календарные дата и время по Москве (без учёта границы 04:00). */
export function moscowClock(at: Date = new Date()): { date: string; hour: number; minute: number } {
  const m = new Date(at.getTime() + MOSCOW_OFFSET_MIN * MS_PER_MIN);
  return { date: m.toISOString().slice(0, 10), hour: m.getUTCHours(), minute: m.getUTCMinutes() };
}

/** Сдвиг даты YYYY-MM-DD на n дней. */
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Сколько суток от a до b (b − a), для дат YYYY-MM-DD. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / MS_PER_DAY);
}

/** «понедельник, 16 ноября» для даты YYYY-MM-DD. */
export function formatDateRu(date: string): string {
  const s = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Момент начала учебных суток date (04:00 по Москве) в мс. */
export function studyDayStartMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) + (DAY_BOUNDARY_HOUR * 60 - MOSCOW_OFFSET_MIN) * MS_PER_MIN;
}

/** Начало следующих учебных суток после момента at. */
export function nextStudyDayStartMs(at: Date = new Date()): number {
  return studyDayStartMs(addDays(studyDate(at), 1));
}
