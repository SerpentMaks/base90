import { Lemmatizer } from "./lemmatize";
export type Cue = { time: string; text: string };
export function parseSubtitles(text: string): Cue[] {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r/g, "");
  const out: Cue[] = [];
  for (const block of clean.split(/\n\s*\n/)) {
    const lines = block.split("\n");
    const i = lines.findIndex((l) =>
      /\d{2}:\d{2}(?::\d{2})?[.,]\d{3}\s*-->/.test(l),
    );
    if (i < 0) continue;
    const body = lines
      .slice(i + 1)
      .join(" ")
      .replace(/<[^>]*>/g, "")
      .replace(/\{[^}]*\}/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
    if (body.trim())
      out.push({ time: lines[i]!.split("-->")[0]!.trim(), text: body.trim() });
  }
  return out;
}
export function subtitleCoverage(
  cues: Cue[],
  known: Set<string>,
  l: Lemmatizer,
) {
  let total = 0,
    have = 0;
  const unknown = new Map<string, { lemma: string; count: number; cue: Cue }>();
  for (const cue of cues)
    for (const token of l.lemmatize(cue.text)) {
      if (token === "#num" || token.startsWith("'")) continue;
      total++;
      if (known.has(token)) have++;
      else {
        const old = unknown.get(token);
        unknown.set(token, {
          lemma: token,
          count: (old?.count ?? 0) + 1,
          cue: old?.cue ?? cue,
        });
      }
    }
  return {
    coverage: total ? have / total : 0,
    total,
    unknown: [...unknown.values()].sort((a, b) => b.count - a.count),
  };
}
