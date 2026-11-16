/**
 * Разбор NGSL 1.2 и NGSL-Spoken 1.2 (CC BY-SA 4.0, newgeneralservicelist.com).
 * Файлы скачиваются в scripts/.cache/ngsl (не в git): см. scripts/fetch-sources.sh.
 */
import { readFileSync } from 'node:fs';

const CACHE = new URL('../.cache/ngsl/', import.meta.url);

/** Пометки расшифровки корпуса, а не слова. */
const TRANSCRIPT_MARKERS = new Set(['pause', 'unclear', 'laughter']);
/** Excel превратил «true» в «TRUE». */
const FIX: Record<string, string> = { TRUE: 'true', FALSE: 'false' };

function csvRows(file: string): string[][] {
  return readFileSync(new URL(file, CACHE), 'utf8')
    .replace(/\r/g, '')
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split(',').map((c) => c.trim()));
}

function ranked(file: string): string[] {
  const [header, ...rows] = csvRows(file);
  const rankCol = header!.findIndex((h) => /rank/i.test(h));
  return rows
    .map((r) => ({ lemma: FIX[r[0]!] ?? r[0]!, rank: Number(r[rankCol]) }))
    .filter((r) => Number.isFinite(r.rank) || r.lemma === 'true')
    .sort((a, b) => (Number.isFinite(a.rank) ? a.rank : 1e9) - (Number.isFinite(b.rank) ? b.rank : 1e9))
    .map((r) => (r.lemma === 'I' ? 'I' : r.lemma.toLowerCase()));
}

/** Порядок изучения: NGSL-Spoken по рангу (без пометок расшифровки), затем NGSL без уже пройденных. */
export function studyOrder(): { lemma: string; list: 'spoken' | 'ngsl' }[] {
  const spoken = ranked('NGSL-Spoken_12_stats.csv').filter((w) => !TRANSCRIPT_MARKERS.has(w));
  const seen = new Set(spoken.map((w) => w.toLowerCase()));
  const general = ranked('NGSL_12_stats.csv').filter((w) => !seen.has(w.toLowerCase()));
  return [...spoken.map((lemma) => ({ lemma, list: 'spoken' as const })), ...general.map((lemma) => ({ lemma, list: 'ngsl' as const }))];
}

/** Обрывки после разбиения по апострофу (isn't → isn + t) и разговорные написания — их разбирает tokenize(). */
function isJunkForm(form: string, all: Set<string>): boolean {
  if (form.length === 1 && form !== 'a' && form !== 'i') return true;
  if (['re', 've', 'll', 'd', 's', 'm', 't', 'y', 'ye', 'gonna', 'gotta', 'hafta', 'wanna', 'ain'].includes(form)) return true;
  if (/n$/.test(form) && /(is|are|was|were|do|does|did|have|has|had|could|would|should|must|need|might|dare)n$/.test(form)) return true;
  if (form === 'don' || form === 'doesn' || form === 'didn') return true;
  if (/in$/.test(form) && all.has(form + 'g')) return true; // doin → doing
  return false;
}

/** Формы, которые в списке ошибочно (won ← won't: это прошедшее время от win). */
const WRONG_FORMS: Record<string, string[]> = { will: ['won', 'wills', 'willed'], can: ['cans', 'canned', 'canning'], and: ['ands'], be: ['beings'] };

/** Таблица форм: lemma → формы (из «lemmatized for teaching» обоих списков). */
export function formsTable(): Record<string, string[]> {
  const table: Record<string, string[]> = {};
  for (const file of ['NGSL-Spoken_12_lemmatized_for_teaching.csv', 'NGSL_12_lemmatized_for_teaching.csv']) {
    for (const row of csvRows(file)) {
      const [head, ...forms] = row.filter(Boolean);
      if (!head) continue;
      const lemma = FIX[head] ?? head.toLowerCase();
      if (TRANSCRIPT_MARKERS.has(lemma)) continue;
      const all = new Set(forms.map((f) => f.toLowerCase()));
      const clean = [...all].filter((f) => f !== lemma && !isJunkForm(f, all) && !(WRONG_FORMS[lemma] ?? []).includes(f));
      table[lemma] = [...new Set([...(table[lemma] ?? []), ...clean])];
    }
  }
  return table;
}
