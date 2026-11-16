import type { WordItem } from '../../src/content/schema.ts';

/** Все английские тексты, которые приложение озвучивает (слова и примеры). */
export function englishTexts(words: WordItem[]): string[] {
  const out = new Set<string>();
  for (const w of words) {
    out.add(w.lemma);
    for (const e of w.examples) out.add(e.en);
  }
  return [...out];
}
