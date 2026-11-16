/**
 * Не даёт закоммитить токены, ключи, email, push-подписки и пользовательские субтитры.
 * Репозиторий публичный, поэтому проверка обязательна.
 *   npm run check-secrets            — все файлы в git (так в CI)
 *   node scripts/check-secrets.ts --staged — только подготовленные к коммиту (pre-commit)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';

type Rule = { name: string; re: RegExp };

const RULES: Rule[] = [
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { name: 'GitHub fine-grained token', re: /\bgithub_pat_[A-Za-z0-9_]{30,}\b/ },
  { name: 'Private key (PEM)', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'VAPID private key', re: /"?privateKey"?\s*[:=]\s*["'][A-Za-z0-9_-]{40,}["']/ },
  { name: 'Push subscription endpoint', re: /https:\/\/(fcm\.googleapis\.com\/fcm\/send|web\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]*notify\.windows\.com)\/[A-Za-z0-9_-]{16,}/ },
  { name: 'Push subscription keys', re: /"p256dh"\s*:\s*"[A-Za-z0-9_-]{40,}"/ },
  { name: 'Email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/ },
];

/** Безопасные «email-подобные» строки. */
const EMAIL_ALLOW = [/@users\.noreply\.github\.com$/i, /@example\.(com|org)$/i, /^noreply@anthropic\.com$/i, /^git@github\.com$/i];

const FORBIDDEN_FILES = [/\.srt$/i, /\.vtt$/i, /(^|\/)\.env(\..*)?$/, /\.pem$/i, /(^|\/)push-subscription.*\.json$/i];
const SKIP = [/^package-lock\.json$/, /^scripts\/check-secrets\.ts$/, /\.(png|jpg|jpeg|gif|ico|webp|woff2?|zip|gz)$/i];

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' });
}

const staged = process.argv.includes('--staged');
let files: string[];
try {
  files = (staged ? git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']) : git(['ls-files'])).split('\n').filter(Boolean);
} catch {
  console.error('check-secrets: не git-репозиторий, пропускаю');
  process.exit(0);
}

const problems: string[] = [];
for (const f of files) {
  if (FORBIDDEN_FILES.some((re) => re.test(f))) {
    problems.push(`${f}: такой файл нельзя коммитить`);
    continue;
  }
  if (SKIP.some((re) => re.test(f)) || !existsSync(f) || statSync(f).size > 5_000_000) continue;
  const text = staged ? git(['show', `:${f}`]) : readFileSync(f, 'utf8');
  text.split('\n').forEach((line, i) => {
    for (const rule of RULES) {
      const m = line.match(new RegExp(rule.re.source, 'g'));
      if (!m) continue;
      const bad = rule.name === 'Email' ? m.filter((e) => !EMAIL_ALLOW.some((a) => a.test(e))) : m;
      if (bad.length) problems.push(`${f}:${i + 1}: ${rule.name}`);
    }
  });
}

if (problems.length) {
  console.error('✗ Найдены возможные секреты или личные данные:\n  ' + problems.join('\n  '));
  console.error('Убери их из файлов (секреты — только через `gh secret set`).');
  process.exit(1);
}
console.log(`✓ check-secrets: ${files.length} файлов, чисто`);
