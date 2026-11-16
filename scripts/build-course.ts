import { readFileSync, writeFileSync } from "node:fs";
import type { Lesson, Drill, Reading } from "../src/content/course.ts";
const lessons: Lesson[] = [];
for (const line of readFileSync("scripts/data/course/grammar.txt", "utf8")
  .split("\n")
  .filter((l) => l && !l.startsWith("#"))) {
  if (line.startsWith("@")) {
    const [w, title, explanation] = line.slice(1).split("|");
    lessons.push({
      id: `g_${w}`,
      week: Number(w),
      title: title!,
      explanation: explanation!,
      examples: [],
      drills: [],
    });
  } else {
    const l = lessons.at(-1)!;
    const [marked, ru] = line.split("|");
    const answer = marked!.match(/\[([^\]]+)\]/)?.[1];
    if (!answer) throw Error(line);
    const en = marked!.replace(/\[|\]/g, "");
    const i = l.drills.length;
    if (l.examples.length < 4) l.examples.push({ en, ru: ru! });
    const tiles = i % 4 === 3;
    l.drills.push({
      id: `${l.id}_${i + 1}`,
      kind: "grammar",
      mode: tiles ? "tiles" : "form",
      prompt: tiles ? ru! : marked!.replace(/\[[^\]]+\]/, "___"),
      en,
      ru: ru!,
      answer: tiles ? en : answer,
      week: l.week,
    });
  }
}
const sounds: Drill[] = [];
const pairs = [
  [
    "west",
    "vest",
    "/west/ — губы округлены, зубы не касаются губы",
    "/vest/ — верхние зубы у нижней губы",
    "w-v",
  ],
  ["wine", "vine", "вино", "виноградная лоза", "w-v"],
  ["wet", "vet", "мокрый", "ветеринар", "w-v"],
  ["worse", "verse", "хуже", "стих", "w-v"],
  ["thin", "sin", "тонкий; язык между зубами", "грех; язык за зубами", "th-s"],
  ["think", "sink", "думать", "тонуть", "th-s"],
  ["then", "den", "тогда; язык между зубами", "логово", "th-d"],
  ["they", "day", "они", "день", "th-d"],
  [
    "ship",
    "sheep",
    "корабль; короткий расслабленный /ɪ/",
    "овца; более долгий напряжённый /iː/",
    "vowels",
  ],
  ["live", "leave", "жить", "уходить", "vowels"],
  ["full", "fool", "полный", "глупец", "vowels"],
  ["pull", "pool", "тянуть", "бассейн", "vowels"],
  ["bad", "bed", "плохой; рот шире для /æ/", "кровать; /e/", "vowels"],
  ["man", "men", "мужчина", "мужчины", "vowels"],
  ["cut", "cart", "резать; /ʌ/", "тележка; /ɑr/ в США", "vowels"],
  ["hat", "hut", "шляпа", "хижина", "vowels"],
  [
    "play",
    "plea",
    "играть; /eɪ/ — движение гласного",
    "просьба; /iː/",
    "diphthongs",
  ],
  [
    "go",
    "goo",
    "идти; /oʊ/ — движение гласного",
    "липкая масса; /uː/",
    "diphthongs",
  ],
  [
    "fifteen",
    "fifty",
    "пятнадцать; ударение в конце",
    "пятьдесят; ударение в начале",
    "numbers",
  ],
  ["thirteen", "thirty", "тринадцать", "тридцать", "numbers"],
  ["eighteen", "eighty", "восемнадцать", "восемьдесят", "numbers"],
  ["fourteen", "forty", "четырнадцать", "сорок", "numbers"],
];
for (const [i, p] of pairs.entries())
  for (let side = 0; side < 2; side++)
    sounds.push({
      id: `pair_${i}_${side}`,
      kind: "pair",
      mode: "choice",
      prompt: `Что прозвучало? ${p[2 + side]}.`,
      en: p[side]!,
      ru: p[2 + side]!,
      answer: p[side]!,
      choices: [p[0]!, p[1]!],
      audio: p[side]!,
      week: i < 12 ? 1 : i < 16 ? 2 : 3,
    });
const connected = [
  ["gonna", "going to", "собираюсь"],
  ["wanna", "want to", "хочу"],
  ["gotta", "got to", "надо"],
  ["whaddaya want", "what do you want", "что ты хочешь"],
  ["lemme see", "let me see", "дай посмотреть"],
  ["gimme a minute", "give me a minute", "дай минуту"],
  ["kinda tired", "kind of tired", "довольно устал"],
  ["I dunno", "I do not know", "я не знаю"],
  ["I'll go", "I will go", "я пойду"],
  ["I've been there", "I have been there", "я там был"],
  ["I'd like tea", "I would like tea", "я бы хотел чаю"],
  ["She's here", "She is here", "она здесь"],
  ["He's just left", "He has just left", "он только что ушёл"],
  ["an apple", "an apple", "яблоко: слова связываются"],
  ["can you help", "can you help", "можешь помочь: can без ударения"],
  ["to the park", "to the park", "в парк: слабое to /tə/"],
  ["you and me", "you and me", "ты и я: слабое and /ən/"],
  ["a cup of tea", "a cup of tea", "чашка чая: слабое of /əv/"],
  ["cups", "cups", "окончание /s/"],
  ["dogs", "dogs", "окончание /z/"],
  ["watches", "watches", "окончание /ɪz/"],
  ["worked", "worked", "окончание /t/"],
  ["played", "played", "окончание /d/"],
  ["wanted", "wanted", "окончание /ɪd/"],
];
for (const [i, [spoken, full, ru]] of connected.entries())
  sounds.push({
    id: `speech_${i}`,
    kind: "speech",
    mode: "dictation",
    prompt: "Расшифруй фразу. Напиши полную форму.",
    en: full!,
    audio: spoken!,
    answer: full!,
    ru: ru!,
    week: ["cups", "dogs", "watches"].includes(full!)
      ? 3
      : ["worked", "played", "wanted"].includes(full!)
        ? 7
        : ["to the park", "you and me", "a cup of tea"].includes(full!)
          ? 4
          : full === "an apple"
            ? 8
            : full === "can you help"
              ? 6
              : 9,
  });

const numberNames = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
  "one hundred",
];
const numbers = [
  ...Array.from({ length: 20 }, (_, i) => i + 1),
  30,
  40,
  50,
  60,
  70,
  80,
  90,
  100,
];
for (const [i, name] of numberNames.entries()) {
  const value = numbers[i]!;
  const alternatives = [
    value,
    ...numbers
      .filter((n) => n !== value)
      .sort((a, b) => Math.abs(a - value) - Math.abs(b - value))
      .slice(0, 3),
  ].map(String);
  sounds.push({
    id: `number_${value}`,
    kind: "pair",
    mode: "choice",
    prompt: "Какое число прозвучало?",
    en: name,
    ru: String(value),
    answer: String(value),
    choices: alternatives,
    audio: name,
    week: value <= 20 ? 1 : 2,
  });
}
for (const [i, [audio, answer]] of [
  ["nine thirty", "09:30"],
  ["ten fifteen", "10:15"],
  ["half past eight", "08:30"],
  ["a quarter to ten", "09:45"],
  ["seven forty five", "07:45"],
  ["twelve twenty", "12:20"],
  ["six fifty", "06:50"],
  ["eleven oh five", "11:05"],
].entries()) {
  sounds.push({
    id: `time_${i}`,
    kind: "speech",
    mode: "choice",
    prompt: "Выбери время, которое прозвучало.",
    en: audio!,
    ru: answer!,
    answer: answer!,
    choices: [answer!, "08:15", "10:30", "12:45"],
    audio: audio!,
    week: 2,
  });
}
for (const [i, text] of ["She can do it.", "She can't do it."].entries())
  sounds.push({
    id: `can_${i}`,
    kind: "pair",
    mode: "choice",
    prompt: "Выбери фразу, которую слышишь.",
    en: text,
    ru: i ? "Она не может это сделать." : "Она может это сделать.",
    answer: text,
    choices: ["She can do it.", "She can't do it."],
    audio: text,
    week: 6,
  });
const readings: Reading[] = JSON.parse(
  readFileSync("scripts/data/course/readings.json", "utf8"),
);
writeFileSync(
  "src/content/course.json",
  JSON.stringify({ lessons, sounds, readings }, null, 1) + "\n",
);
console.log(
  `✓ ${lessons.length} уроков, ${lessons.flatMap((l) => l.drills).length} упражнений, ${sounds.length} звуковых заданий, ${readings.length} текстов`,
);
