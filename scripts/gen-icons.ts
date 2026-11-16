/**
 * Генерирует иконки PWA из одного SVG-макета.
 * Запуск: npm run icons (результат коммитится в public/).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const ACCENT = '#2a63d4';

/** full=true — квадрат без скругления (iOS и maskable скругляют сами). */
function svg(full: boolean, scale = 1): string {
  const r = full ? 0 : 112;
  const s = scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${r}" fill="${ACCENT}"/>
  <g transform="translate(256 256) scale(${s}) translate(-256 -256)">
    <text x="256" y="356" text-anchor="middle" font-family="Noto Sans, DejaVu Sans, Arial, sans-serif"
      font-weight="800" font-size="236" fill="#ffffff" letter-spacing="-8">90</text>
    <rect x="156" y="384" width="200" height="14" rx="8" fill="#ffffff" opacity="0.55"/>
    <text x="256" y="148" text-anchor="middle" font-family="Noto Sans, DejaVu Sans, Arial, sans-serif"
      font-weight="700" font-size="54" fill="#ffffff" opacity="0.85" letter-spacing="6">BASE</text>
  </g>
</svg>`;
}

const out = new URL('../public/', import.meta.url);
mkdirSync(new URL('icons/', out), { recursive: true });

const jobs: [string, string, number][] = [
  ['icons/icon-192.png', svg(false), 192],
  ['icons/icon-512.png', svg(false), 512],
  ['icons/icon-maskable-512.png', svg(true, 0.78), 512],
  ['apple-touch-icon.png', svg(true, 0.9), 180],
];

for (const [path, src, size] of jobs) {
  const png = await sharp(Buffer.from(src)).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(new URL(path, out), png);
  console.log(`✓ ${path} (${size}×${size})`);
}
writeFileSync(new URL('favicon.svg', out), svg(false));
console.log('✓ favicon.svg');
