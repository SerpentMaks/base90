/**
 * Схемы контента (§7.2). Проверяются в CI скриптом scripts/validate-content.ts.
 * Приложение импортирует отсюда только типы (import type) — zod не попадает в бандл.
 */
import { z } from 'zod';

const en = z.string().min(1).refine((s) => !/\b(St|Mr|Mrs|Dr|etc)\.|[&@#%*_~^<>{}|\\]/.test(s), {
  message: 'текст для озвучки содержит сокращение или символ, который синтезатор прочитает неверно',
});

export const exampleSchema = z
  .object({
    en,
    ru: z.string().min(1),
    source: z.enum(['tatoeba', 'generated']),
    tatoebaId: z.number().int().positive().optional(),
    author: z.string().min(1).optional(),
  })
  .refine((e) => e.source !== 'tatoeba' || (e.tatoebaId && e.author), {
    message: 'у предложения Tatoeba нет атрибуции (tatoebaId и author)',
  });

export const POS = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'determiner', 'interjection', 'number', 'phrase'] as const;

export const wordSchema = z.object({
  id: z.string().regex(/^w_[a-z0-9_]+$/),
  lemma: z.string().min(1),
  rank: z.number().int().positive(),
  pos: z.array(z.enum(POS)).min(1),
  ipa: z.string().regex(/^\/.+\/$/),
  ru: z.array(z.string().min(1)).min(1).max(3),
  forms: z.array(z.string()).optional(),
  note: z.string().max(120).optional(),
  examples: z.array(exampleSchema).min(1).max(2),
  tags: z.array(z.string()).optional(),
});

export const wordsFileSchema = z.array(wordSchema);

export type WordItem = z.infer<typeof wordSchema>;
export type Example = z.infer<typeof exampleSchema>;
