import { readFileSync, writeFileSync } from "node:fs";
import { phonemize } from "../tools/tts/node_modules/phonemizer/dist/phonemizer.js";
const words = JSON.parse(readFileSync("src/content/words.json", "utf8")).filter(
  (w) => !w.tags?.includes("chunk"),
);
const lines = readFileSync("scripts/data/chunks.txt", "utf8")
  .trim()
  .split("\n");
if (lines.length !== 200) throw Error("Нужно 200 чанков: " + lines.length);
const chunks = [];
for (const [i, line] of lines.entries()) {
  const [en, ru] = line.split("|");
  const lemma = en.replace(/[.!?]+$/, "");
  const ipa = (await phonemize(lemma, "en-us")).join(" ").replaceAll("ɹ", "r");
  chunks.push({
    id: "w_chunk_" + String(i + 1).padStart(3, "0"),
    lemma,
    rank: 0,
    pos: ["phrase"],
    ipa: `/${ipa}/`,
    ru: [ru],
    tags: ["chunk", "film"],
    examples: [{ en, ru, source: "generated" }],
    ...(/gonna|wanna|gotta|Lemme|kinda|Whaddaya/.test(en)
      ? {
          note: "Разговорное сокращение. Для официального письма используй полную форму.",
        }
      : {}),
  });
}
const out = [];
for (const [i, w] of words.entries()) {
  out.push(w);
  if ((i + 1) % 6 === 0 && chunks.length) out.push(chunks.shift());
}
out.push(...chunks);
out.forEach((w, i) => (w.rank = i + 1));
writeFileSync("src/content/words.json", JSON.stringify(out, null, 1) + "\n");
console.log(`✓ ${words.length} слов + ${lines.length} фраз`);
