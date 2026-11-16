/**
 * Генерирует недостающие записи по плану (plan.json от scripts/audio-plan.ts).
 *   node gen.mjs <plan.json> <outDir>
 * Модель Kokoro-82M (Apache 2.0) скачивается с Hugging Face при первом запуске.
 * Нужен ffmpeg: WAV → AAC (m4a), обрезка тишины по краям.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { KokoroTTS } from "kokoro-js";

const [planPath, outDirArg] = process.argv.slice(2);
if (!planPath || !outDirArg) {
  console.error("usage: node gen.mjs <plan.json> <outDir>");
  process.exit(2);
}
const outDir = resolve(outDirArg);
const plan = JSON.parse(readFileSync(planPath, "utf8"));
const todo = plan.filter(
  (p) =>
    process.argv.includes("--force") ||
    !existsSync(join(outDir, p.voice, `${p.key}.m4a`)),
);
console.log(`в плане ${plan.length}, нужно сгенерировать ${todo.length}`);
if (!todo.length) process.exit(0);

const tmp = resolve(`.tmp-${process.pid}`);
mkdirSync(tmp, { recursive: true });
const t0 = Date.now();
const tts = await KokoroTTS.from_pretrained(
  "onnx-community/Kokoro-82M-v1.0-ONNX",
  { dtype: "q8", device: "cpu" },
);
console.log(`модель загружена за ${((Date.now() - t0) / 1000).toFixed(1)} с`);

const FILTER = [
  "silenceremove=start_periods=1:start_threshold=-50dB",
  "areverse",
  "silenceremove=start_periods=1:start_threshold=-50dB",
  "areverse",
  "adelay=60",
  "apad=pad_dur=0.12",
].join(",");

let done = 0;
// Короткие слова без контекста неоднозначны для eSpeak. Эти формы соответствуют значениям курса.
const PHONEMES = {
  "can you help": "kən jʊ hˈɛlp",
  "to the park": "tə ðə pˈɑːɹk",
  "you and me": "jʊ ən mˈiː",
  "a cup of tea": "ə kˈʌp əv tˈiː",
  live: "lˈɪv",
  close: "klˈoʊz",
  use: "jˈuːz",
  read: "ɹˈiːd",
  lead: "lˈiːd",
  wind: "wˈɪnd",
  record: "ɹˈɛkɚd",
  content: "kˈɑːntɛnt",
  produce: "pɹədˈuːs",
};
for (const item of todo) {
  const wav = join(tmp, `${item.key}.wav`);
  const phones = PHONEMES[item.text.toLowerCase()];
  const audio = phones
    ? await tts.generate_from_ids(
        tts.tokenizer(phones, { truncation: true }).input_ids,
        { voice: item.voice, speed: item.speed ?? 1 },
      )
    : await tts.generate(item.text, {
        voice: item.voice,
        speed: item.speed ?? 1,
      });
  await audio.save(wav);
  mkdirSync(join(outDir, item.voice), { recursive: true });
  execFileSync("ffmpeg", [
    "-loglevel",
    "error",
    "-y",
    "-i",
    wav,
    "-af",
    FILTER,
    "-ac",
    "1",
    "-ar",
    "24000",
    "-c:a",
    "aac",
    "-b:a",
    "40k",
    "-movflags",
    "+faststart",
    join(tmp, `${item.key}.m4a`),
  ]);
  renameSync(
    join(tmp, `${item.key}.m4a`),
    join(outDir, item.voice, `${item.key}.m4a`),
  );
  rmSync(wav);
  done++;
  if (done % 25 === 0 || done === todo.length) {
    const rate = (Date.now() - t0) / 1000 / done;
    console.log(
      `  ${done}/${todo.length}  (~${rate.toFixed(1)} с/шт, осталось ~${Math.round(((todo.length - done) * rate) / 60)} мин)`,
    );
  }
}
rmSync(tmp, { recursive: true, force: true });
console.log("✓ готово");
