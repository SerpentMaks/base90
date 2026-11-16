import course from "./course.json" with { type: "json" };
export type Drill = {
  id: string;
  kind: "grammar" | "cloze" | "pair" | "speech" | "dictation";
  mode: "form" | "tiles" | "dictation" | "choice";
  prompt: string;
  en: string;
  ru: string;
  answer: string;
  choices?: string[];
  audio?: string;
  week: number;
};
export type Lesson = {
  id: string;
  week: number;
  title: string;
  explanation: string;
  examples: { en: string; ru: string }[];
  drills: Drill[];
};
export type Reading = {
  id: string;
  type: "story" | "dialogue";
  title: string;
  unlockRank: number;
  coverageAtUnlock: number;
  sentences: { en: string; ru: string; speaker?: string }[];
  questions: { prompt: string; choices: string[]; answer: string }[];
};
export const LESSONS = course.lessons as Lesson[];
export const SOUNDS = course.sounds as Drill[];
export const READINGS = course.readings as Reading[];
export const DRILLS = [...LESSONS.flatMap((l) => l.drills), ...SOUNDS];
export const drillById = new Map(DRILLS.map((d) => [d.id, d]));

import reference from "../../scripts/data/course/reference.json" with {type:"json"};
export const IRREGULARS=reference.irregulars;
export const PHRASALS=reference.phrasals;
