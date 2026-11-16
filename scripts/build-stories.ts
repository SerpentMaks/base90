import { readFileSync, writeFileSync } from "node:fs";
import { Lemmatizer } from "../src/lib/lemmatize.ts";
import type { Reading } from "../src/content/course.ts";
import type { WordItem } from "../src/content/schema.ts";
const words: WordItem[] = JSON.parse(
  readFileSync("src/content/words.json", "utf8"),
);
const forms = JSON.parse(readFileSync("src/content/forms.json", "utf8"));
const L = new Lemmatizer(
  forms,
  words.filter((w) => !w.tags?.includes("chunk")).map((w) => w.lemma),
);
const rank = new Map(
  words
    .filter((w) => !w.tags?.includes("chunk"))
    .map((w) => [w.lemma.toLowerCase(), w.rank]),
);
const names = new Set([
  "alex",
  "mia",
  "ben",
  "english",
  "french",
  "russian",
  "russia",
  "#num",
  "'s",
  "'d",
]);
const readings: Reading[] = [];
for (const line of (
  readFileSync("scripts/data/course/readings.txt", "utf8") +
  "\n" +
  readFileSync("scripts/data/course/dialogues.txt", "utf8")
)
  .split("\n")
  .filter(Boolean)) {
  if (line.startsWith("@")) {
    const [type, title] = line.slice(1).split("|");
    readings.push({
      id: "r_" + (readings.length + 1),
      type: type as Reading["type"],
      title: title!,
      unlockRank: 0,
      coverageAtUnlock: 0,
      sentences: [],
      questions: [],
    });
  } else if (line.startsWith("?")) {
    const [prompt, answer, ...wrong] = line.slice(1).split("|");
    readings.at(-1)!.questions.push({
      prompt: prompt!,
      answer: answer!,
      choices: [answer!, ...wrong],
    });
  } else {
    const [en, ru] = line.split("|");
    if (!en || !ru) throw Error(line);
    readings.at(-1)!.sentences.push({ en, ru });
  }
}
const problems: string[] = [];
for (const r of readings) {
  if (r.type === "dialogue") {
    r.sentences.forEach((s, i) => (s.speaker = i % 2 ? "Мия" : "Алекс"));
    r.questions = [
      {
        prompt: "Что ответили на первый вопрос?",
        answer: r.sentences[1]!.ru,
        choices: [r.sentences[1]!.ru, r.sentences[0]!.ru, r.sentences[3]!.ru],
      },
      {
        prompt: "Чем закончился разговор?",
        answer: r.sentences[3]!.ru,
        choices: [r.sentences[3]!.ru, r.sentences[0]!.ru, r.sentences[2]!.ru],
      },
    ];
  }
  const lemmas = L.lemmatize(r.sentences.map((s) => s.en).join(" ")).filter(
    (l) => !names.has(l),
  );
  // Подбираем реальную точку открытия; не объявляем незнакомое слово «известным».
  for (let unlock = 100; unlock <= 1500; unlock += 10) {
    const cov =
      lemmas.filter((l) => (rank.get(l) ?? Infinity) <= unlock).length /
      lemmas.length;
    if (cov >= 0.95) {
      r.unlockRank = unlock;
      r.coverageAtUnlock = cov;
      break;
    }
  }
  if (!r.unlockRank)
    problems.push(
      `${r.title}: нет 95% покрытия; неизвестны ${[...new Set(lemmas.filter((l) => !rank.has(l)))].join(", ")}`,
    );
}
if (problems.length) throw Error(problems.join("\n"));
writeFileSync(
  "scripts/data/course/readings.json",
  JSON.stringify(readings, null, 1) + "\n",
);
console.log(`✓ ${readings.length} текстов с покрытием ≥95%`);
