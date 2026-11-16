/**
 * Схемы контента (§7.2). Проверяются в CI скриптом scripts/validate-content.ts.
 * Также проверяет личные слова при импорте прогресса.
 */
import { z } from "zod";

const en = z
  .string()
  .min(1)
  .refine((s) => !/\b(St|Mr|Mrs|Dr|etc)\.|[&@#%*_~^<>{}|\\]/.test(s), {
    message:
      "текст для озвучки содержит сокращение или символ, который синтезатор прочитает неверно",
  });

export const exampleSchema = z
  .object({
    en: z.string().min(1),
    ru: z.string().min(1),
    source: z.enum(["tatoeba", "generated", "personal"]),
    tatoebaId: z.number().int().positive().optional(),
    author: z.string().min(1).optional(),
    ruTatoebaId: z.number().int().positive().optional(),
    ruAuthor: z.string().min(1).optional(),
  })
  .refine((e) => e.source === "personal" || en.safeParse(e.en).success, {
    message: "Неподходящий текст для TTS",
  })
  .refine(
    (e) =>
      e.source !== "tatoeba" ||
      (e.tatoebaId && e.author && e.ruTatoebaId && e.ruAuthor),
    {
      message: "у предложения Tatoeba нет атрибуции (tatoebaId и author)",
    },
  );

export const POS = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "pronoun",
  "preposition",
  "conjunction",
  "determiner",
  "interjection",
  "number",
  "phrase",
  "other",
] as const;

export const wordSchema = z
  .object({
    id: z.string().regex(/^w_[a-z0-9_]+$/),
    lemma: z.string().min(1),
    rank: z.number().int().positive(),
    pos: z.array(z.enum(POS)).min(1),
    ipa: z.union([z.string().regex(/^\/.+\/$/), z.literal("")]),
    ru: z.array(z.string().min(1)).min(1).max(3),
    forms: z.array(z.string()).optional(),
    note: z.string().max(120).optional(),
    examples: z.array(exampleSchema).min(1).max(2),
    tags: z.array(z.string()).optional(),
  })
  .refine((w) => w.ipa !== "" || w.tags?.includes("personal"), {
    message: "Транскрипция нужна для слов курса",
  });

export const wordsFileSchema = z.array(wordSchema);

export type WordItem = z.infer<typeof wordSchema>;
export type Example = z.infer<typeof exampleSchema>;
