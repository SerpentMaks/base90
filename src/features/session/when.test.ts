import { describe, expect, it } from 'vitest';
import { formatWhen } from './when';

const NOW = Date.parse('2026-11-17T07:00:00Z'); // 10:00 МСК

describe('formatWhen', () => {
  it('минуты, сегодня, завтра, через N дней', () => {
    expect(formatWhen(NOW + 10 * 60000, NOW)).toBe('через 10 мин');
    expect(formatWhen(NOW + 5 * 3600000, NOW)).toBe('сегодня в 15:00');
    expect(formatWhen(Date.parse('2026-11-18T05:00:00Z'), NOW)).toBe('завтра');
    expect(formatWhen(Date.parse('2026-11-20T05:00:00Z'), NOW)).toBe('через 3 дня');
    expect(formatWhen(Date.parse('2026-11-22T05:00:00Z'), NOW)).toBe('через 5 дней');
    expect(formatWhen(Date.parse('2026-12-08T05:00:00Z'), NOW)).toBe('через 21 день');
  });
});
