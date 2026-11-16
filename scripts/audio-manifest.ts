/** Список имеющихся записей → src/content/audio.json (приложение знает, что можно играть офлайн). */
import { existsSync, readdirSync, writeFileSync } from 'node:fs';

const root = new URL('../public/audio/', import.meta.url);
const manifest: Record<string, string[]> = {};
if (existsSync(root)) {
  for (const voice of readdirSync(root, { withFileTypes: true })) {
    if (!voice.isDirectory() || voice.name === 'demo') continue;
    manifest[voice.name] = readdirSync(new URL(`${voice.name}/`, root))
      .filter((f) => f.endsWith('.m4a'))
      .map((f) => f.slice(0, -4))
      .sort();
  }
}
writeFileSync(new URL('../src/content/audio.json', import.meta.url), JSON.stringify(manifest) + '\n');
console.log(`✓ audio-manifest: ${Object.entries(manifest).map(([v, k]) => `${v}: ${k.length}`).join(', ') || 'пусто'}`);
