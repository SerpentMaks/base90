import { db } from "../db/db";
import { wordSchema, type WordItem } from "../content/schema";
let previouslyLoaded = false;
export async function loadPersonalWords() {
  const rows = (await db.progress.toArray()).filter((row) =>
    row.key.startsWith("personalWord:"),
  );
  if (!rows.length && !previouslyLoaded) return;
  const content = await import("../content");
  content.clearPersonalWords();
  previouslyLoaded = true;
  for (const row of rows) {
    const parsed = wordSchema.safeParse(row.value);
    if (
      parsed.success &&
      parsed.data.id.startsWith("w_personal_") &&
      parsed.data.tags?.includes("personal")
    )
      content.registerPersonalWord(parsed.data);
  }
}
export async function addPersonalWord(
  lemma: string,
  ru: string,
  context: string,
  time: string,
) {
  if (!/^[a-z]+(?:['-][a-z]+)*$/i.test(lemma) || !ru.trim() || ru.length > 100)
    throw new Error("Укажи короткий перевод слова.");
  const id = "w_personal_" + lemma.toLowerCase().replace(/[^a-z]/g, "_");
  const item: WordItem = wordSchema.parse({
    id,
    lemma: lemma.toLowerCase(),
    rank: 2000,
    pos: ["other"],
    ipa: "",
    ru: [ru.trim()],
    tags: ["personal", "film"],
    note: "Твой перевод из субтитров. Проверь, подходит ли он к этой реплике.",
    examples: [
      {
        en: context.slice(0, 500),
        ru: "Твой контекст · " + time,
        source: "personal",
      },
    ],
  });
  await db.progress.put({
    key: "personalWord:" + id,
    value: item,
    updatedAt: Date.now(),
  });
  (await import("../content")).registerPersonalWord(item);
  previouslyLoaded = true;
  return item;
}
