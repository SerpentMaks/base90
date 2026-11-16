/** Доступ к контенту в рантайме. JSON прекэшируется Service Worker'ом — работает офлайн. */
import type { WordItem } from "./schema";
import wordsJson from "./words.json";

export const WORDS = (wordsJson as WordItem[])
  .slice()
  .sort((a, b) => a.rank - b.rank);
export const WORD_ORDER = WORDS.map((w) => w.id);
const byId = new Map(WORDS.map((w) => [w.id, w]));
export function registerPersonalWord(item: WordItem) {
  if (!item.id.startsWith("w_personal_") || !item.tags?.includes("personal"))
    throw new Error("Неверное личное слово");
  const index = WORDS.findIndex((w) => w.id === item.id);
  if (index >= 0) WORDS[index] = item;
  else {
    WORDS.push(item);
    WORD_ORDER.push(item.id);
  }
  byId.set(item.id, item);
}
export function clearPersonalWords() {
  for (let i = WORDS.length - 1; i >= 0; i--)
    if (WORDS[i]!.tags?.includes("personal")) {
      byId.delete(WORDS[i]!.id);
      const j = WORD_ORDER.indexOf(WORDS[i]!.id);
      if (j >= 0) WORD_ORDER.splice(j, 1);
      WORDS.splice(i, 1);
    }
}

export function word(id: string): WordItem {
  const w = byId.get(id);
  if (!w) throw new Error(`нет слова ${id}`);
  return w;
}

export const POS_RU: Record<string, string> = {
  noun: "существительное",
  verb: "глагол",
  adjective: "прилагательное",
  adverb: "наречие",
  pronoun: "местоимение",
  preposition: "предлог",
  conjunction: "союз",
  determiner: "определитель",
  interjection: "междометие",
  number: "числительное",
  phrase: "фраза",
  other: "слово",
};

/** 3 неверных варианта перевода: сначала той же части речи, без совпадающих значений. */
export function distractors(
  target: WordItem,
  count = 3,
  rnd: () => number = Math.random,
): string[] {
  const taken = new Set(target.ru);
  const pool = WORDS.filter(
    (w) =>
      w.id !== target.id &&
      !w.ru.some((r) => taken.has(r)) &&
      !meaningsOverlap(target.ru, w.ru),
  );
  const same = pool.filter((w) => w.pos.some((p) => target.pos.includes(p)));
  const sameSet = new Set(same);
  const other = pool.filter((w) => !sameSet.has(w));
  const shuffle = <T>(a: T[]) =>
    a
      .map((x) => [rnd(), x] as const)
      .sort((p, q) => p[0] - q[0])
      .map(([, x]) => x);
  const choices: string[] = [];
  for (const w of [...shuffle(same), ...shuffle(other)]) {
    const answer = w.ru[0]!;
    if (!choices.includes(answer)) choices.push(answer);
    if (choices.length === count) break;
  }
  return choices;
}

const RU_SYNONYMS = [
  ["цена", "стоимость"],
  ["полагать", "думать", "считать", "предполагать"],
  ["начинать", "приступать"],
  ["заканчивать", "завершать"],
  ["помощь", "поддержка"],
  ["возможно", "вероятно"],
  ["правильный", "верный"],
  ["плохой", "дурной"],
  ["хороший", "прекрасный", "отличный"],
  ["большой", "огромный", "крупный"],
  ["маленький", "небольшой"],
];
function meaningKeys(meanings: string[]): Set<string> {
  const tokens =
    meanings
      .join(" ")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/\([^)]*\)/g, "")
      .match(/[а-я]+/g) ?? [];
  return new Set(
    tokens
      .filter((t) => t.length >= 4)
      .map((t) => {
        const group = RU_SYNONYMS.findIndex((g) => g.includes(t));
        return group >= 0 ? "syn:" + group : t;
      }),
  );
}
export function meaningsOverlap(a: string[], b: string[]): boolean {
  const keys = meaningKeys(a);
  return [...meaningKeys(b)].some((k) => keys.has(k));
}
