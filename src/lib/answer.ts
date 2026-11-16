/** Проверка напечатанных ответов: регистр, пробелы и пунктуация не важны; опечатка в 1 символ = «почти». */
import type { AutoResult } from './fsrs';

export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[.,!?;:"()\[\]{}…—–-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Расстояние Дамерау–Левенштейна (перестановка соседних букв — тоже одна ошибка). */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  return d[m]![n]!;
}

/**
 * Сравнить ввод с допустимыми ответами. Для коротких слов (< 4 букв) опечатка не прощается:
 * одна буква там уже другое слово (on/in, he/she).
 */
export function checkTyped(input: string, accepted: string[]): { result: AutoResult; expected: string } {
  const got = normalizeAnswer(input);
  const variants = accepted.map((a) => ({ raw: a, norm: normalizeAnswer(a) }));
  const exact = variants.find((v) => v.norm === got);
  if (exact) return { result: 'correct', expected: exact.raw };
  if (got.length > 0) {
    for (const v of variants) {
      if (v.norm.replace(/\s/g, '').length >= 4 && editDistance(got, v.norm) === 1) return { result: 'almost', expected: v.raw };
    }
  }
  return { result: 'wrong', expected: variants[0]?.raw ?? '' };
}
