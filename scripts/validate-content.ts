/**
 * Валидатор контента (§7.3). Запускается в CI перед сборкой и роняет её при ошибках.
 * Этап 1: контента ещё нет — проверяем только, что все JSON в src/content читаются.
 * Схемы zod, дубли, ссылки и покрытие историй добавляются на этапах 3 и 6.
 */
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../src/content/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
let errors = 0;
for (const f of files) {
  try {
    JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
  } catch (e) {
    errors++;
    console.error(`✗ ${f}: невалидный JSON — ${(e as Error).message}`);
  }
}
if (errors) process.exit(1);
console.log(`✓ validate-content: ${files.length} файлов контента`);
