import { it, expect } from "vitest";
import { meaningsOverlap, distractors, WORDS } from "./index";
it("близкие переводы и пояснения в скобках не превращаются в неверные варианты", () => {
  expect(meaningsOverlap(["цена"], ["стоимость"])).toBe(true);
  expect(meaningsOverlap(["думать"], ["предполагать"])).toBe(true);
  expect(meaningsOverlap(["носить (одежду)"], ["носить"])).toBe(true);
  expect(meaningsOverlap(["книга"], ["машина"])).toBe(false);
  for (const w of WORDS.filter((_, i) => i % 77 === 0)) {
    const options = distractors(w);
    expect(options).toHaveLength(3);
    expect(new Set(options).size).toBe(3);
    expect(options.some((o) => meaningsOverlap(w.ru, [o]))).toBe(false);
  }
});
