import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { Lemmatizer } from "../src/lib/lemmatize.ts";
import type { WordItem } from "../src/content/schema.ts";
const text = z.string().min(1);
const drill = z
  .object({
    id: text,
    kind: z.enum(["grammar", "cloze", "pair", "speech", "dictation"]),
    mode: z.enum(["form", "tiles", "dictation", "choice"]),
    prompt: text,
    en: text,
    ru: text,
    answer: text,
    choices: z.array(text).optional(),
    audio: text.optional(),
    week: z.number().int().min(1).max(13),
  })
  .refine(
    (d) =>
      d.mode !== "choice" ||
      (d.choices?.includes(d.answer) && new Set(d.choices).size >= 2),
    "варианты не содержат ответ",
  );
const pair = z.object({ en: text, ru: text, speaker: text.optional() });
const schema = z.object({
  lessons: z
    .array(
      z.object({
        id: text,
        week: z.number().int().min(1).max(13),
        title: text,
        explanation: text.refine(
          (s) => s.split(/\s+/).length <= 150,
          "больше 150 слов",
        ),
        examples: z.array(pair).min(3).max(5),
        drills: z.array(drill).min(8).max(12),
      }),
    )
    .min(13),
  sounds: z.array(drill).min(40),
  readings: z.array(
    z.object({
      id: text,
      type: z.enum(["story", "dialogue"]),
      title: text,
      unlockRank: z.number().int().min(1).max(1500),
      coverageAtUnlock: z.number().min(0.95).max(1),
      sentences: z.array(pair).min(4),
      questions: z
        .array(
          z.object({
            prompt: text,
            answer: text,
            choices: z.array(text).min(2),
          }),
        )
        .min(2)
        .max(4),
    }),
  ),
});
const raw = JSON.parse(readFileSync("src/content/course.json", "utf8"));
const course = schema.parse(raw);
const words = JSON.parse(
  readFileSync("src/content/words.json", "utf8"),
) as WordItem[];
if (
  words.filter((w) => !w.tags?.includes("chunk")).length < 1300 ||
  words.filter((w) => w.tags?.includes("chunk")).length < 200
)
  throw Error("Нужны ≥1300 слов и ≥200 фраз");
if (
  course.readings.filter((r) => r.type === "story").length < 45 ||
  course.readings.filter((r) => r.type === "dialogue").length < 70
)
  throw Error("Нужны ≥45 историй и ≥70 диалогов");
const L = new Lemmatizer(
  JSON.parse(readFileSync("src/content/forms.json", "utf8")),
  words.filter((w) => !w.tags?.includes("chunk")).map((w) => w.lemma),
);
const ranks = new Map(
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
const report = [
  "# Проверка историй и диалогов",
  "",
  "Покрытие пересчитано валидатором по фактическим леммам, а не взято из сохранённого процента. Имена персонажей, названия языков и числа не учитываются.",
  "",
  "| Текст | Тип | Открытие | Слов | Покрытие | Незнакомые |",
  "|---|---|---:|---:|---:|---|",
];
const ids = new Set<string>();
for (const x of [
  ...course.lessons,
  ...course.lessons.flatMap((l) => l.drills),
  ...course.sounds,
  ...course.readings,
]) {
  if (ids.has(x.id)) throw Error("Дубликат " + x.id);
  ids.add(x.id);
}
for (const r of course.readings) {
  const all = r.sentences.map((s) => s.en).join(" ");
  const lemmas = L.lemmatize(all).filter((l) => !names.has(l));
  const unknown = lemmas.filter(
    (l) => (ranks.get(l) ?? Infinity) > r.unlockRank,
  );
  const cov = 1 - unknown.length / lemmas.length;
  if (cov < 0.95 || Math.abs(cov - r.coverageAtUnlock) > 0.00001)
    throw Error(`${r.id}: неверное покрытие ${cov}`);
  if (
    r.type === "story" &&
    (all.split(/\s+/).length < 60 || all.split(/\s+/).length > 300)
  )
    throw Error(r.id + ": история должна иметь 60–300 слов");
  if (
    r.type === "dialogue" &&
    (r.sentences.length < 4 || r.sentences.length > 10)
  )
    throw Error(r.id + ": нужно 4–10 реплик");
  for (const q of r.questions)
    if (!q.choices.includes(q.answer))
      throw Error(r.id + ": нет правильного ответа");
  report.push(
    `| ${r.title} | ${r.type} | ${r.unlockRank} | ${all.split(/\s+/).length} | ${(cov * 100).toFixed(1)}% | ${[...new Set(unknown)].join(", ")} |`,
  );
}
writeFileSync("course-report.md", report.join("\n") + "\n");
console.log(
  `✓ курс: ${course.lessons.length} недель, ${course.readings.length} текстов; покрытие всех ≥95%`,
);
