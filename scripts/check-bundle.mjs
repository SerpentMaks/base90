import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
const code = readdirSync("dist/assets").filter(
  (f) =>
    f.endsWith(".js") && !/(?:course|word|lesson|forms|audio)-content-/.test(f),
);
const bytes = code.reduce(
  (sum, f) => sum + gzipSync(readFileSync("dist/assets/" + f)).length,
  0,
);
console.log(
  `Код страницы без учебного контента: ${(bytes / 1024).toFixed(1)} КиБ gzip`,
);
if (bytes > 300 * 1024) throw Error("Превышен лимит 300 КиБ");
