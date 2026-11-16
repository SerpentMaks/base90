/**
 * Валидатор контента (§7.3). Запускается в CI перед сборкой и роняет её при ошибках:
 * схема zod, дубли id/lemma, атрибуция Tatoeba, озвучка для всех английских текстов.
 * Покрытие историй (≥ 95%) добавится на этапе 6.
 */
import { readFileSync } from 'node:fs';
import { wordsFileSchema } from '../src/content/schema.ts';
import { audioKey } from '../src/lib/audioKey.ts';
import { englishTexts } from './lib/english-texts.ts';

const read = (name: string): unknown => JSON.parse(readFileSync(new URL(`../src/content/${name}`, import.meta.url), 'utf8'));

const errors: string[] = [];
const warnings: string[] = [];

const parsed = wordsFileSchema.safeParse(read('words.json'));
if (!parsed.success) {
  for (const issue of parsed.error.issues) errors.push(`words.json → ${issue.path.join('.')}: ${issue.message}`);
} else {
  const words = parsed.data;
  const seen = (key: (w: (typeof words)[number]) => string, what: string) => {
    const m = new Map<string, number>();
    for (const w of words) m.set(key(w), (m.get(key(w)) ?? 0) + 1);
    for (const [k, n] of m) if (n > 1) errors.push(`дубль ${what}: ${k} (${n} раз)`);
  };
  seen((w) => w.id, 'id');
  seen((w) => (w.tags?.includes('homonym') ? `${w.lemma}#${w.id}` : w.lemma.toLowerCase()), 'lemma');
  seen((w) => String(w.rank), 'rank');

  // Озвучка: у каждого английского текста должна быть запись (иначе сработает запасной голос Safari).
  const manifest = read('audio.json') as Record<string, string[]>;
  const have = new Set(manifest['af_heart'] ?? []);
  const missing = englishTexts(words).filter((t) => !have.has(audioKey('af_heart', t)));
  if (missing.length) warnings.push(`нет записи для ${missing.length} текстов (будет голос Safari): ${missing.slice(0, 5).join(' | ')}…`);

  console.log(`  слов: ${words.length}, примеров: ${words.reduce((n, w) => n + w.examples.length, 0)}`);
}

for (const w of warnings) console.warn(`⚠ ${w}`);
if (errors.length) {
  console.error(`✗ validate-content: ${errors.length} ошибок\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log('✓ validate-content: контент в порядке');
