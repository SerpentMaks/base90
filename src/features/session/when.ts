import { studyDate } from '../../lib/time';
import { daysBetween } from '../../lib/time';

/** «через 10 мин», «сегодня в 19:40», «завтра», «через 3 дня» — по московскому времени. */
export function formatWhen(ms: number, now = Date.now()): string {
  const diffMin = Math.round((ms - now) / 60000);
  if (diffMin <= 1) return 'сейчас';
  if (diffMin < 60) return `через ${diffMin} мин`;
  const days = daysBetween(studyDate(new Date(now)), studyDate(new Date(ms)));
  if (days === 0) {
    const t = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(ms);
    return `сегодня в ${t}`;
  }
  if (days === 1) return 'завтра';
  const n = days % 10 === 1 && days % 100 !== 11 ? 'день' : [2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100) ? 'дня' : 'дней';
  return `через ${days} ${n}`;
}
