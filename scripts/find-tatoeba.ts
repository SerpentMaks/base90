/** Поиск предложений Tatoeba для ручного выбора примеров: node scripts/find-tatoeba.ts "regex" [макс. слов] */
import { loadPairs } from "./lib/tatoeba.ts";
const re = new RegExp(process.argv[2] ?? ".", "i");
const maxWords = Number(process.argv[3] ?? 7);
const hits = loadPairs()
  .filter(
    (p) =>
      re.test(p.en) &&
      p.en.split(/\s+/).length <= maxWords &&
      !/\d/.test(p.en) &&
      p.ru.length < 60,
  )
  .sort((a, b) => a.en.length - b.en.length)
  .slice(0, 25);
for (const h of hits) console.log(`${h.en}  —  ${h.ru}`);
