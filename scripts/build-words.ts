/**
 * Сборка словаря (§7.3): порядок NGSL → обогащение (scripts/data/enrich/*.json) → примеры i+1 из Tatoeba.
 *   node scripts/build-words.ts   → src/content/words.json + content-report.md
 * В словарь попадают только слова, для которых уже написано обогащение (переводы проверяются вручную).
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Example, WordItem } from "../src/content/schema.ts";
import { wordsFileSchema } from "../src/content/schema.ts";
import { Lemmatizer } from "../src/lib/lemmatize.ts";
import { loadPairs, type TatoebaPair } from "./lib/tatoeba.ts";

/** examples: готовый пример или строка — точный английский текст предложения из Tatoeba (атрибуция подтянется). */
type Enrich = Omit<WordItem, "id" | "lemma" | "rank" | "examples" | "forms"> & {
  examples?: (Example | string)[];
  forms?: string[];
};
type OrderItem = { n: number; lemma: string; list: string; forms: string[] };

const read = <T>(rel: string): T =>
  JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8")) as T;
const order = read<OrderItem[]>("./data/order.json");
const forms = read<Record<string, string[]>>("../src/content/forms.json");
const enrich: Record<string, Enrich> = {};
for (const f of readdirSync(new URL("./data/enrich/", import.meta.url))
  .filter((f) => f.endsWith(".json"))
  .sort()) {
  Object.assign(enrich, read<Record<string, Enrich>>(`./data/enrich/${f}`));
}
for (const [lemma, [en, ru]] of Object.entries(
  read<Record<string, [string, string]>>("./data/own-examples.json"),
)) {
  if (enrich[lemma])
    enrich[lemma]!.examples = [{ en, ru, source: "generated" }];
}

const L = new Lemmatizer(forms);
const rankOf = new Map(order.map((o) => [o.lemma.toLowerCase(), o.n]));

/**
 * Первые BASE_RANK слов считаются «базой» для примеров: ученик знает ~100 слов, а из первых
 * 10–20 слов естественного предложения не собрать. Дальше правило i+1 строгое.
 */
const BASE_RANK = 120;

/** Служебные слова считаются известными с первого дня (§2.5). */
const FUNCTION = new Set([
  "the",
  "a",
  "be",
  "do",
  "have",
  "not",
  "to",
  "of",
  "in",
  "on",
  "at",
  "for",
  "with",
  "and",
  "but",
  "or",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "this",
  "that",
  "'s",
  "'d",
  "will",
  "can",
  "#num",
]);
/** Мрачные и неуместные темы — такие примеры не берём. */
const BLOCK =
  /\b(kill\w*|die[ds]?|dying|dead|death|suicide|guns?|shoot\w*|sex\w*|naked|nazis?|hitler|drugs?|rape\w*|murder\w*|bombs?|drunk|corpse|blood\w*|idiot|stupid|hate[ds]?|slave\w*|weapon\w*)\b/i;

type Cand = {
  pair: TatoebaPair;
  lemmas: string[];
  names: string[];
  tokens: number;
};

function prepare(): Cand[] {
  const out: Cand[] = [];
  for (const pair of loadPairs()) {
    const { en, ru } = pair;
    if (/[\d"“”;:()\[\]]/.test(en) || !/[.?!]$/.test(en) || BLOCK.test(en))
      continue;
    if (ru.length > 70 || /[A-Za-z]/.test(ru)) continue;
    const lemmas = L.lemmatize(en);
    if (lemmas.length < 3 || lemmas.length > 10) continue;
    const names = [
      ...new Set(
        (en.match(/(?<=\s)[A-Z][a-z]+/g) ?? [])
          .filter((w) => w !== "I")
          .map((w) => w.toLowerCase()),
      ),
    ];
    const first = en.match(/^[A-Z][a-z]+/)?.[0].toLowerCase();
    if (
      first &&
      !rankOf.has(L.lemma(first)) &&
      !FUNCTION.has(first) &&
      /^(tom|mary|john|alice|ken|jack|mike|bob|lucy|dan|linda|jim|tony|kate|emily|sami|layla|maria|anna|paul)$/.test(
        first,
      )
    )
      names.push(first);
    if (names.length > 1) continue;
    out.push({ pair, lemmas, names, tokens: lemmas.length });
  }
  return out;
}

function stems(ru: string[]): { stem: string; weight: number }[] {
  const res: { stem: string; weight: number }[] = [];
  ru.forEach((meaning, i) => {
    for (const w of meaning
      .replace(/\(.*?\)/g, " ")
      .toLowerCase()
      .replace(/ё/g, "е")
      .split(/[^а-я-]+/)) {
      if (w.length < 3) continue;
      res.push({
        stem: w.slice(0, Math.max(3, w.length - 2)),
        weight: i === 0 ? 4 : 2,
      });
    }
  });
  return res;
}

function coverage(
  c: Cand,
  target: string,
  rank: number,
  slack: number,
): number {
  let unknown = 0;
  for (const l of c.lemmas) {
    if (l === target || FUNCTION.has(l) || c.names.includes(l)) continue;
    if ((rankOf.get(l) ?? Infinity) >= Math.max(rank, BASE_RANK) + slack)
      unknown++;
  }
  return 1 - unknown / c.tokens;
}

function pickExamples(
  target: string,
  rank: number,
  ru: string[],
  cands: Cand[],
): { examples: Example[]; tier: number; cov: number[] } {
  const st = stems(ru);
  const withTarget = candidateIndex.get(target) ?? [];
  for (const [tier, slack] of [[1, 0]] as const) {
    const scored = withTarget
      .map((c) => {
        const cov = coverage(c, target, rank, slack);
        if (cov < 0.9) return null;
        const ruL = c.pair.ru.toLowerCase().replace(/ё/g, "е");
        let score = 0;
        for (const s of st) if (ruL.includes(s.stem)) score += s.weight;
        score -= Math.abs(c.tokens - 5) * 0.6;
        score -= c.names.length * 2.5;
        // «it» в переводе стало «её/его» — новичка это путает.
        const enL = c.pair.en.toLowerCase();
        if (
          /\bit\b/.test(enL) &&
          !/\b(he|she|him|her|his)\b/.test(enL) &&
          /(^|[^а-яё])(её|ее|его|она|он|ей|ему|неё|нее|него)([^а-яё]|$)/i.test(
            c.pair.ru,
          )
        )
          score -= 4;
        // Сложная грамматика не для первых недель: would've, could've, пассив.
        if (
          /(would|could|should|must|might)'ve|\b(was|were) (seen|made|told|given)\b/.test(
            enL,
          )
        )
          score -= 3;
        if (/'/.test(c.pair.en)) score += 0.5;
        if (c.pair.en.toLowerCase().split(/\W+/).includes(target)) score += 1;
        return { c, cov, score };
      })
      .filter((x): x is { c: Cand; cov: number; score: number } => !!x)
      .sort(
        (a, b) => b.score - a.score || a.c.pair.en.length - b.c.pair.en.length,
      );
    if (!scored.length) continue;
    const chosen = [scored[0]!];
    const firstSet = new Set(scored[0]!.c.lemmas);
    const second = scored.slice(1).find((x) => {
      const overlap =
        x.c.lemmas.filter((l) => firstSet.has(l)).length /
        Math.max(x.c.lemmas.length, firstSet.size);
      return overlap < 0.5 && x.c.names.length + chosen[0]!.c.names.length <= 1;
    });
    if (second) chosen.push(second);
    return {
      tier,
      cov: chosen.map((x) => x.cov),
      examples: chosen.map(({ c }) => ({
        en: c.pair.en,
        ru: c.pair.ru,
        source: "tatoeba" as const,
        tatoebaId: c.pair.enId,
        author: c.pair.enAuthor,
        ruTatoebaId: c.pair.ruId,
        ruAuthor: c.pair.ruAuthor,
      })),
    };
  }
  return { tier: 0, cov: [], examples: [] };
}

const t0 = Date.now();
const cands = prepare();
const candidateIndex = new Map<string, Cand[]>();
for (const c of cands)
  for (const lemma of new Set(c.lemmas)) {
    const list = candidateIndex.get(lemma) ?? [];
    list.push(c);
    candidateIndex.set(lemma, list);
  }
const allPairs = new Map<string, TatoebaPair>();
for (const p of loadPairs()) if (!allPairs.has(p.en)) allPairs.set(p.en, p);

function resolve(ex: Example | string, lemma: string): Example {
  if (typeof ex !== "string") return ex;
  const p = allPairs.get(ex);
  if (!p) throw new Error(`${lemma}: в Tatoeba нет предложения «${ex}»`);
  return {
    en: p.en,
    ru: p.ru,
    source: "tatoeba",
    tatoebaId: p.enId,
    author: p.enAuthor,
    ruTatoebaId: p.ruId,
    ruAuthor: p.ruAuthor,
  };
}
const words: WordItem[] = [];
const report: string[] = [];
const problems: string[] = [];

for (const o of order) {
  const e = enrich[o.lemma];
  if (!e) continue;
  const lemmaKey = o.lemma.toLowerCase();
  const id = `w_${lemmaKey.replace(/[^a-z0-9]+/g, "_")}`;
  let examples = e.examples?.map((x) => resolve(x, o.lemma));
  let info = "выбраны вручную";
  if (!examples?.length) {
    const p = pickExamples(lemmaKey, o.n, e.ru, cands);
    examples = p.examples;
    info = p.tier
      ? `Tatoeba, уровень ${p.tier}, покрытие ${p.cov.map((c) => Math.round(c * 100) + "%").join("/")}`
      : "НЕТ ПРИМЕРА";
    if (!p.tier)
      problems.push(
        `${o.n}. ${o.lemma}: нет подходящего примера в Tatoeba — нужен свой`,
      );
    if (p.tier >= 2)
      problems.push(
        `${o.n}. ${o.lemma}: пример не строго i+1 (уровень ${p.tier})`,
      );
  }
  const { examples: _x, forms: ownForms, ...rest } = e;
  words.push({
    id,
    lemma: o.lemma,
    rank: o.n,
    ...rest,
    forms: ownForms ?? forms[lemmaKey] ?? [],
    examples: examples ?? [],
  });
  report.push(
    `| ${o.n} | **${o.lemma}** ${e.ipa} | ${e.ru.join("; ")} | ${(examples ?? []).map((x) => `${x.en} — ${x.ru}`).join("<br>")} | ${info} |`,
  );
}

const parsed = wordsFileSchema.safeParse(words);
if (!parsed.success) {
  for (const i of parsed.error.issues.slice(0, 80))
    console.error(
      `✗ ${words[Number(i.path[0])]?.lemma} ${i.path.join(".")}: ${i.message}`,
    );
  process.exit(1);
}

writeFileSync(
  new URL("../src/content/words.json", import.meta.url),
  JSON.stringify(words, null, 1) + "\n",
);
writeFileSync(
  new URL("../content-report.md", import.meta.url),
  [
    "# Отчёт по контенту",
    "",
    `Сгенерировано \`scripts/build-words.ts\`. Слов в словаре: **${words.length}** из пула ${order.length}.`,
    "",
    "## Требует внимания",
    "",
    ...(problems.length ? problems.map((p) => `- ${p}`) : ["- нет"]),
    "",
    "## Словарь",
    "",
    "| # | Слово | Перевод | Примеры | Источник примеров |",
    "|---|---|---|---|---|",
    ...report,
    "",
  ].join("\n"),
);
console.log(
  `✓ build-words: ${words.length} слов за ${((Date.now() - t0) / 1000).toFixed(1)} с; кандидатов-предложений ${cands.length}; проблем ${problems.length}`,
);
