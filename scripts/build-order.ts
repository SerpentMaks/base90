/**
 * Шаг 1 сборки словаря: порядок изучения и таблица форм.
 *   → src/content/forms.json  (для лемматизатора в приложении: мост к фильмам)
 *   → scripts/data/order.json (пул слов по порядку — по нему пишется обогащение)
 */
import { writeFileSync } from "node:fs";
import { formsTable, studyOrder } from "./lib/ngsl.ts";

export const POOL_SIZE = 1300;

const order = studyOrder();
const forms = formsTable();
const pool = order.slice(0, POOL_SIZE).map((w, i) => ({
  n: i + 1,
  lemma: w.lemma,
  list: w.list,
  forms: forms[w.lemma.toLowerCase()] ?? [],
}));

// Таблица форм — по всем словам NGSL в порядке частоты (частые побеждают при совпадении форм).
const ordered: Record<string, string[]> = {};
for (const w of order)
  ordered[w.lemma.toLowerCase()] = forms[w.lemma.toLowerCase()] ?? [];
for (const [l, f] of Object.entries(forms)) ordered[l] ??= f;

writeFileSync(
  new URL("../src/content/forms.json", import.meta.url),
  JSON.stringify(ordered),
);
writeFileSync(
  new URL("./data/order.json", import.meta.url),
  JSON.stringify(pool, null, 0).replace(/\},\{/g, "},\n{"),
);
console.log(
  `✓ build-order: ${order.length} лемм всего, пул ${pool.length} (${pool.filter((p) => p.list === "spoken").length} разговорных), последнее: ${pool.at(-1)?.lemma}`,
);
