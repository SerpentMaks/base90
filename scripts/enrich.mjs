// Авторские переводы; американская IPA сверена с ipa-dict (MIT), с ручным выбором значения.
import { readFileSync, writeFileSync } from "node:fs";
const ipaLexicon = new Map(
  readFileSync("scripts/.cache/ipa-en_US.txt", "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t")),
);
const pos = {
  n: "noun",
  v: "verb",
  a: "adjective",
  d: "adverb",
  p: "preposition",
  c: "conjunction",
  i: "interjection",
  q: "pronoun",
  x: "number",
};
const order = JSON.parse(readFileSync("scripts/data/order.json", "utf8"));
const rows = readFileSync("scripts/data/enrichment.txt", "utf8")
  .split("\n")
  .filter((x) => x && !x.startsWith("#"));
const out = {};
const ipaFix = {
  record: "ˈrɛkɚd",
  object: "ˈɑbdʒɛkt",
  content: "ˈkɑntɛnt",
  wind: "wɪnd",
  minute: "ˈmɪnɪt",
  produce: "prəˈduːs",
  live: "lɪv",
  close: "kloʊz",
  read: "riːd",
  lead: "liːd",
  use: "juːz",
};
const notes = {
  due: "The report is due today — отчёт нужно сдать сегодня. Due to — «из-за».",
  information: "Неисчисляемое: some information, без an и без окончания -s.",
  advice: "Неисчисляемое: some advice. Один совет — a piece of advice.",
  furniture: "Неисчисляемое: furniture, без -s.",
  news: "Окончание -s, но глагол в единственном числе: The news is good.",
  magazine: "Журнал, не магазин. Магазин — store или shop.",
  library: "Библиотека, не книжный магазин. Книжный магазин — bookstore.",
  eventually: "«В конце концов», не «возможно». Возможно — possibly.",
  artist: "Обычно художник; исполнитель тоже возможен. Не только «артист».",
  policy: "Правило или курс действий. Политика как сфера — politics.",
  actual: "«Настоящий, фактический», не «актуальный». Актуальный — relevant.",
  data: "Данные. В разговорной речи встречаются data is и data are.",
  recipe: "Рецепт блюда. Рецепт от врача — prescription.",
  clothes: "Одежда: всегда форма множественного числа. Clothes are clean.",
  equipment: "Неисчисляемое: equipment, без -s.",
  mathematics: "Название предмета: Mathematics is… В США часто говорят math.",
  practice:
    "В американском английском и существительное, и глагол пишутся practice.",
  college: "В США часто означает обучение в вузе: go to college.",
  football: "В США обычно американский футбол. Привычный нам футбол — soccer.",
  period: "В США также «точка» в конце предложения.",
  since:
    "Since + начало периода; for + длительность: since Monday, for two days.",
  die: "Die — умирать (действие), dead — мёртвый (состояние).",
  lie: "Lie — лежать или лгать. Lay — класть что-то: lay the book on the table.",
  lay: "Класть что-то: lay the book down. Лежать — lie. Прошедшее от lie (лежать) тоже lay.",
  raise: "Raise требует объект: raise your hand. Rise — подниматься самому.",
  affect:
    "Affect — глагол «влиять». Effect — обычно существительное «воздействие».",
  arm: "Arm — рука целиком; hand — кисть.",
  foot: "Ступня; нога целиком — leg. Множественное число: feet.",
  price: "Price — цена, cost — стоимость или стоить.",
  listen: "Listen to someone — слушать кого-то. Не пропускай to.",
  discuss: "Discuss something — обсуждать что-то, без about.",
  marry: "Marry someone — жениться на ком-то, без with.",
  suggest: "Suggest doing something. Не suggest to do.",
  bloody:
    "В разговорном британском — грубоватый усилитель. В американской речи встречается реже.",
};
for (const line of rows) {
  const m = line.match(/^([^:=]+)(?::([nvadpciqx]))?=(.+)$/);
  if (!m) throw Error(line);
  const [, lemma, part = "n", ru] = m;
  if (out[lemma]) throw Error("duplicate " + lemma);
  const entry = ipaLexicon.get(lemma)?.split(", ")[0];
  const phones =
    ipaFix[lemma] ??
    entry?.slice(1, -1).replaceAll("ɹ", "r").replaceAll("ɫ", "l");
  if (!phones) throw Error("Нет проверенной американской IPA для " + lemma);
  out[lemma] = {
    pos: [pos[part]],
    ipa: `/${phones}/`,
    ru: ru.split(";"),
    ...(notes[lemma] ? { note: notes[lemma] } : {}),
  };
}
for (const x of order.slice(200, 1300))
  if (!out[x.lemma]) throw Error("missing " + x.lemma);
if (Object.keys(out).length !== 1100)
  throw Error("expected1100 got" + Object.keys(out).length);
writeFileSync(
  "scripts/data/enrich/0201-1300.json",
  JSON.stringify(out, null, 1) + "\n",
);
console.log("✓ 1100 переводов и транскрипций");
