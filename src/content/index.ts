/** Доступ к контенту в рантайме. JSON прекэшируется Service Worker'ом — работает офлайн. */
import type { WordItem } from './schema';
import wordsJson from './words.json';

export const WORDS = (wordsJson as WordItem[]).slice().sort((a, b) => a.rank - b.rank);
export const WORD_ORDER = WORDS.map((w) => w.id);
const byId = new Map(WORDS.map((w) => [w.id, w]));

export function word(id: string): WordItem {
  const w = byId.get(id);
  if (!w) throw new Error(`нет слова ${id}`);
  return w;
}

export const POS_RU: Record<string, string> = {
  noun: 'существительное',
  verb: 'глагол',
  adjective: 'прилагательное',
  adverb: 'наречие',
  pronoun: 'местоимение',
  preposition: 'предлог',
  conjunction: 'союз',
  determiner: 'определитель',
  interjection: 'междометие',
  number: 'числительное',
  phrase: 'фраза',
};

/** 3 неверных варианта перевода: сначала той же части речи, без совпадающих значений. */
export function distractors(target: WordItem, count = 3, rnd: () => number = Math.random): string[] {
  const taken = new Set(target.ru);
  const pool = WORDS.filter((w) => w.id !== target.id && !w.ru.some((r) => taken.has(r)));
  const same = pool.filter((w) => w.pos.some((p) => target.pos.includes(p)));
  const other = pool.filter((w) => !same.includes(w));
  const shuffle = <T,>(a: T[]) => a.map((x) => [rnd(), x] as const).sort((p, q) => p[0] - q[0]).map(([, x]) => x);
  return [...shuffle(same), ...shuffle(other)].slice(0, count).map((w) => w.ru[0]!);
}
