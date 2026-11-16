import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, formatDateRu, moscowClock, studyDate } from './time';

describe('studyDate (Москва, граница 04:00)', () => {
  it('03:59 МСК — ещё вчерашний учебный день', () => {
    expect(studyDate(new Date('2026-11-17T00:59:00Z'))).toBe('2026-11-16');
  });
  it('04:00 МСК — уже новый учебный день', () => {
    expect(studyDate(new Date('2026-11-17T01:00:00Z'))).toBe('2026-11-17');
  });
  it('01:00 МСК (22:00 UTC накануне) засчитывается во вчерашний день', () => {
    expect(studyDate(new Date('2026-11-16T22:00:00Z'))).toBe('2026-11-16');
  });
  it('23:30 МСК — тот же день', () => {
    expect(studyDate(new Date('2026-11-17T20:30:00Z'))).toBe('2026-11-17');
  });
  it('переход через год', () => {
    expect(studyDate(new Date('2026-12-31T23:00:00Z'))).toBe('2026-12-31'); // 02:00 МСК 1 янв
    expect(studyDate(new Date('2027-01-01T01:00:00Z'))).toBe('2027-01-01');
  });
});

describe('moscowClock', () => {
  it('UTC+3 без перевода часов (лето и зима)', () => {
    expect(moscowClock(new Date('2026-07-01T09:15:00Z'))).toEqual({ date: '2026-07-01', hour: 12, minute: 15 });
    expect(moscowClock(new Date('2026-01-01T21:30:00Z'))).toEqual({ date: '2026-01-02', hour: 0, minute: 30 });
  });
});

describe('addDays / daysBetween', () => {
  it('считают через границы месяцев', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-11-16', '2026-12-16')).toBe(30);
    expect(daysBetween('2026-11-16', '2026-11-16')).toBe(0);
  });
});

describe('formatDateRu', () => {
  it('день недели с заглавной, месяц — строчными', () => {
    expect(formatDateRu('2026-11-16')).toBe('Понедельник, 16 ноября');
  });
});
