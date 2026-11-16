/**
 * Токенизация и простая лемматизация английского (§6.12, §7.4).
 * Один модуль для билд-скриптов (i+1 примеры, покрытие историй) и приложения (мост к фильмам).
 * Порядок: таблица форм (из NGSL + неправильные глаголы) → правила -s/-ed/-ing/-er/-est → как есть.
 */

export type FormsTable = Record<string, string[]>; // lemma → формы

/** Разворачиваем сокращения: «isn't» → is + not, «I'm» → I + am, «gonna» → going + to. */
const CONTRACTIONS: Record<string, string[]> = {
  "can't": ["can", "not"],
  cannot: ["can", "not"],
  "won't": ["will", "not"],
  "shan't": ["shall", "not"],
  "ain't": ["be", "not"],
  "let's": ["let", "us"],
  gonna: ["going", "to"],
  wanna: ["want", "to"],
  gotta: ["got", "to"],
  hafta: ["have", "to"],
  lemme: ["let", "me"],
  gimme: ["give", "me"],
  kinda: ["kind", "of"],
  sorta: ["sort", "of"],
  dunno: ["don't", "know"],
  whaddaya: ["what", "do", "you"],
  "y'all": ["you", "all"],
};
const SUFFIXES: [RegExp, string[]][] = [
  [/^(.+)n't$/, ["$1", "not"]],
  [/^(.+)'m$/, ["$1", "am"]],
  [/^(.+)'re$/, ["$1", "are"]],
  [/^(.+)'ll$/, ["$1", "will"]],
  [/^(.+)'ve$/, ["$1", "have"]],
  [/^(.+)'d$/, ["$1", "'d"]], // would/had — служебное
  [/^(.+)'s$/, ["$1", "'s"]], // is/has/притяжательное — служебное
  [/^(.+s)'$/, ["$1"]], // the boys' → boys
];

export function normalizeQuotes(s: string): string {
  return s.replace(/[‘’ʼ`´]/g, "'").replace(/[“”]/g, '"');
}

/** Слова в нижнем регистре; числа отдельно помечаются; сокращения развёрнуты. */
export function tokenize(text: string): string[] {
  const raw =
    normalizeQuotes(text)
      .toLowerCase()
      .match(/[a-z]+(?:['-][a-z]+)*'?|\d+(?:[.,]\d+)*/g) ?? [];
  const out: string[] = [];
  for (let t of raw) {
    if (/^\d/.test(t)) {
      out.push("#num");
      continue;
    }
    if (t.endsWith("'") && !t.endsWith("s'")) t = t.slice(0, -1);
    const fixed = CONTRACTIONS[t];
    if (fixed) {
      out.push(
        ...fixed.flatMap((p) => (CONTRACTIONS[p] ? CONTRACTIONS[p]! : [p])),
      );
      continue;
    }
    let done = false;
    for (const [re, parts] of SUFFIXES) {
      const m = t.match(re);
      if (m) {
        const base = m[1]!;
        // «don't» → do + not, «isn't» → is + not, «doesn't» → does + not
        out.push(
          ...parts.map((p) =>
            p.replace(
              "$1",
              base === "ca" ? "can" : base === "wo" ? "will" : base,
            ),
          ),
        );
        done = true;
        break;
      }
    }
    if (done) continue;
    // дефисные слова: well-known → well + known
    if (t.includes("-")) out.push(...t.split("-").filter(Boolean));
    else out.push(t);
  }
  return out;
}

export class Lemmatizer {
  private formToLemma = new Map<string, string>();
  private lemmas = new Set<string>();

  /** tables — в порядке приоритета (частые слова первыми): при совпадении форм побеждает первая. */
  constructor(forms: FormsTable, priority: string[] = Object.keys(forms)) {
    for (const lemma of priority) {
      const l = lemma.toLowerCase();
      this.lemmas.add(l);
      if (!this.formToLemma.has(l)) this.formToLemma.set(l, l);
      for (const f of forms[lemma] ?? forms[l] ?? []) {
        const k = f.toLowerCase();
        if (!this.formToLemma.has(k)) this.formToLemma.set(k, l);
      }
    }
  }

  isLemma(w: string): boolean {
    return this.lemmas.has(w);
  }

  lemma(token: string): string {
    const t = token.toLowerCase();
    const known = this.formToLemma.get(t);
    if (known) return known;
    for (const cand of ruleCandidates(t)) {
      if (this.lemmas.has(cand)) return cand;
    }
    return t;
  }

  lemmatize(text: string): string[] {
    return tokenize(text).map((t) =>
      t.startsWith("#") || t.startsWith("'") ? t : this.lemma(t),
    );
  }
}

/** Кандидаты на лемму по правилам окончаний (проверяются по словарю). */
export function ruleCandidates(t: string): string[] {
  const c: string[] = [];
  const add = (s: string) => s.length >= 2 && c.push(s);
  if (t.endsWith("ies")) add(t.slice(0, -3) + "y");
  if (t.endsWith("es")) add(t.slice(0, -2));
  if (t.endsWith("s") && !t.endsWith("ss")) add(t.slice(0, -1));
  if (t.endsWith("ied")) add(t.slice(0, -3) + "y");
  if (t.endsWith("ed")) {
    add(t.slice(0, -2));
    add(t.slice(0, -1));
    if (/(.)\1ed$/.test(t)) add(t.slice(0, -3));
  }
  if (t.endsWith("ing")) {
    add(t.slice(0, -3));
    add(t.slice(0, -3) + "e");
    if (/(.)\1ing$/.test(t)) add(t.slice(0, -4));
    if (t.endsWith("ying")) add(t.slice(0, -4) + "ie");
  }
  if (t.endsWith("ier")) add(t.slice(0, -3) + "y");
  if (t.endsWith("iest")) add(t.slice(0, -4) + "y");
  if (t.endsWith("er")) {
    add(t.slice(0, -2));
    add(t.slice(0, -1));
    if (/(.)\1er$/.test(t)) add(t.slice(0, -3));
  }
  if (t.endsWith("est")) {
    add(t.slice(0, -3));
    add(t.slice(0, -2));
    if (/(.)\1est$/.test(t)) add(t.slice(0, -4));
  }
  if (t.endsWith("ly")) add(t.slice(0, -2));
  return c;
}
