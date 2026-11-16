/**
 * План озвучки: все английские тексты контента → tools/tts/plan.json ({voice, text, key}).
 * Хеш имени файла считается тем же кодом, что и в приложении (src/lib/audioKey.ts).
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { WordItem } from "../src/content/schema.ts";
import { audioKey, normalizeSpeechText } from "../src/lib/audioKey.ts";
import { englishTexts } from "./lib/english-texts.ts";

const NARRATOR = "af_heart";
const words = JSON.parse(
  readFileSync(new URL("../src/content/words.json", import.meta.url), "utf8"),
) as WordItem[];

const plan = englishTexts(words).map((text) => ({
  voice: NARRATOR,
  text: normalizeSpeechText(text),
  key: audioKey(NARRATOR, text),
}));
writeFileSync(
  new URL("../tools/tts/plan.json", import.meta.url),
  JSON.stringify(plan, null, 1),
);
console.log(`✓ audio-plan: ${plan.length} текстов → tools/tts/plan.json`);
