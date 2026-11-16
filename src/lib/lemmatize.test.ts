import { describe, expect, it } from "vitest";
import { Lemmatizer, ruleCandidates, tokenize } from "./lemmatize";

const FORMS = {
  be: ["am", "is", "are", "was", "were", "been", "being"],
  do: ["does", "did", "done", "doing"],
  go: ["goes", "went", "gone", "going"],
  have: ["has", "had", "having"],
  i: ["me", "my", "mine"],
  see: ["sees", "saw", "seen", "seeing"],
  saw: ["saws"],
  not: [],
  can: [],
  will: [],
  try: [],
  stop: [],
  make: [],
  big: [],
  happy: [],
  study: [],
  want: [],
  to: [],
  know: [],
  what: [],
  you: [],
  let: [],
  us: [],
};
const L = new Lemmatizer(FORMS);

describe("tokenize", () => {
  it("сокращения разворачиваются", () => {
    expect(tokenize("I don't know.")).toEqual(["i", "do", "not", "know"]);
    expect(tokenize("I can't, it isn't.")).toEqual([
      "i",
      "can",
      "not",
      "it",
      "is",
      "not",
    ]);
    expect(tokenize("I'm gonna go. We'll see. They've won't")).toEqual([
      "i",
      "am",
      "going",
      "to",
      "go",
      "we",
      "will",
      "see",
      "they",
      "have",
      "will",
      "not",
    ]);
    expect(tokenize("Let's go! Whaddaya want?")).toEqual([
      "let",
      "us",
      "go",
      "what",
      "do",
      "you",
      "want",
    ]);
  });
  it("«умные» апострофы, числа, дефисы", () => {
    expect(tokenize("I don’t have 25 well-known friends")).toEqual([
      "i",
      "do",
      "not",
      "have",
      "#num",
      "well",
      "known",
      "friends",
    ]);
  });
  it("'s и 'd — служебные токены", () => {
    expect(tokenize("Tom's here. I'd go")).toEqual([
      "tom",
      "'s",
      "here",
      "i",
      "'d",
      "go",
    ]);
  });
});

describe("Lemmatizer", () => {
  it("таблица форм: неправильные глаголы и местоимения", () => {
    expect(L.lemma("went")).toBe("go");
    expect(L.lemma("was")).toBe("be");
    expect(L.lemma("me")).toBe("i");
  });
  it("при совпадении формы побеждает более частое слово (первое в приоритете)", () => {
    expect(L.lemma("saw")).toBe("see");
  });
  it("правила окончаний", () => {
    expect(L.lemma("tried")).toBe("try");
    expect(L.lemma("stopped")).toBe("stop");
    expect(L.lemma("making")).toBe("make");
    expect(L.lemma("bigger")).toBe("big");
    expect(L.lemma("happiest")).toBe("happy");
    expect(L.lemma("studies")).toBe("study");
    expect(L.lemma("wants")).toBe("want");
  });
  it("неизвестное слово остаётся как есть", () => {
    expect(L.lemma("xylophones")).toBe("xylophones");
  });
  it("lemmatize целого предложения", () => {
    expect(L.lemmatize("I didn't see you, I'm sorry")).toEqual([
      "i",
      "do",
      "not",
      "see",
      "you",
      "i",
      "be",
      "sorry",
    ]);
  });
});

describe("ruleCandidates", () => {
  it("даёт варианты для -ing с удвоением и -e", () => {
    expect(ruleCandidates("running")).toContain("run");
    expect(ruleCandidates("taking")).toContain("take");
    expect(ruleCandidates("dying")).toContain("die");
  });
});
