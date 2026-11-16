import { it, expect } from "vitest";
import { parseSubtitles, subtitleCoverage } from "./subtitles";
import { Lemmatizer } from "./lemmatize";
it("разбирает SRT и VTT локально и считает частоты лемм", () => {
  const text =
    "1\n00:00:01,000 --> 00:00:02,000\n<i>I went home.</i>\n\n2\n00:00:03,000 --> 00:00:04,000\nGo home!";
  const cues = parseSubtitles(text);
  expect(cues).toHaveLength(2);
  const c = subtitleCoverage(
    cues,
    new Set(["i", "go"]),
    new Lemmatizer({ i: [], go: ["went"], home: [] }),
  );
  expect(c.coverage).toBe(0.6);
  expect(c.unknown[0]!.count).toBe(2);
  expect(
    parseSubtitles("WEBVTT\n\n00:01.000 --> 00:02.000\nHello."),
  ).toHaveLength(1);
});
