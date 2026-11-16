/**
 * Пары предложений Tatoeba eng↔rus (CC BY 2.0 FR) из выгрузки manythings.org/anki (rus-eng.zip).
 * Формат строки: en \t ru \t «CC-BY 2.0 (France) Attribution: tatoeba.org #enId (enAuthor) & #ruId (ruAuthor)».
 */
import { readFileSync } from 'node:fs';

export type TatoebaPair = { en: string; ru: string; enId: number; enAuthor: string; ruId: number; ruAuthor: string };

const ATTR = /#(\d+) \(([^)]+)\) & #(\d+) \(([^)]+)\)/;

export function loadPairs(): TatoebaPair[] {
  const text = readFileSync(new URL('../.cache/tatoeba/rus.txt', import.meta.url), 'utf8');
  const byEn = new Map<number, TatoebaPair>();
  for (const line of text.split('\n')) {
    const [en, ru, attr] = line.split('\t');
    if (!en || !ru || !attr) continue;
    const m = attr.match(ATTR);
    if (!m) continue;
    const pair = { en: en.trim(), ru: ru.trim(), enId: Number(m[1]), enAuthor: m[2]!, ruId: Number(m[3]), ruAuthor: m[4]! };
    const prev = byEn.get(pair.enId);
    // Из нескольких переводов берём самый короткий (обычно самый прямой).
    if (!prev || pair.ru.length < prev.ru.length) byEn.set(pair.enId, pair);
  }
  return [...byEn.values()];
}
