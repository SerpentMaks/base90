import type { WordItem } from "../../src/content/schema.ts";
import { readFileSync } from "node:fs";

/** Все английские тексты, которые приложение озвучивает (слова и примеры). */
export function englishTexts(words: WordItem[]): string[] {
  const out = new Set<string>();
  for (const w of words) {
    out.add(w.lemma);
    for (const e of w.examples) out.add(e.en);
  }
  const file = new URL("../../src/content/course.json", import.meta.url);
  const course = JSON.parse(readFileSync(file, "utf8")) as {
    lessons: {
      examples: { en: string }[];
      drills: { en: string; audio?: string }[];
    }[];
    sounds: { en: string; audio?: string }[];
    readings: { type: string; sentences: { en: string }[] }[];
  };
  for (const l of course.lessons) {
    for (const e of l.examples) out.add(e.en);
    for (const d of l.drills) out.add(d.audio ?? d.en);
  }
  for (const d of course.sounds) {
    out.add(d.audio ?? d.en);
    out.add(d.en);
  }
  for (const r of course.readings) for (const s of r.sentences) out.add(s.en);
  const reference = JSON.parse(
    readFileSync(
      new URL("../data/course/reference.json", import.meta.url),
      "utf8",
    ),
  );
  for (const row of reference.phrasals) out.add(row[2]);
  const dialogues = course.readings.filter((r) => r.type === "dialogue");
  for (const index of [0, 20, 40])
    if (dialogues[index])
      out.add(dialogues[index]!.sentences.map((s) => s.en).join(" "));
  out.add("Hello! Let's learn some English.");
  return [...out];
}
