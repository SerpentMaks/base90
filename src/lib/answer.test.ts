import { describe, expect, it } from 'vitest';
import { checkTyped, editDistance, normalizeAnswer } from './answer';
import { gradeAuto, Rating } from './fsrs';

describe('normalizeAnswer', () => {
  it('регистр, пробелы, пунктуация, «умные» апострофы', () => {
    expect(normalizeAnswer('  I DON’T know!  ')).toBe("i don't know");
    expect(normalizeAnswer('What’s going on?')).toBe("what's going on");
  });
});

describe('editDistance', () => {
  it('замена, вставка, удаление, перестановка = 1', () => {
    expect(editDistance('think', 'thank')).toBe(1);
    expect(editDistance('know', 'knoww')).toBe(1);
    expect(editDistance('people', 'peple')).toBe(1);
    expect(editDistance('really', 'raelly')).toBe(1);
    expect(editDistance('come', 'go')).toBe(3);
  });
});

describe('checkTyped', () => {
  it('точный ответ', () => {
    expect(checkTyped('Know', ['know']).result).toBe('correct');
  });
  it('опечатка в одну букву → почти', () => {
    expect(checkTyped('peple', ['people'])).toEqual({ result: 'almost', expected: 'people' });
    expect(checkTyped('thnik', ['think']).result).toBe('almost');
  });
  it('короткие слова опечаток не прощают', () => {
    expect(checkTyped('ga', ['go']).result).toBe('wrong');
    expect(checkTyped('com', ['come']).result).toBe('almost'); // 4 буквы — уже прощаем
  });
  it('пустой ввод и совсем другое слово → неверно', () => {
    expect(checkTyped('', ['know']).result).toBe('wrong');
    expect(checkTyped('want', ['know']).result).toBe('wrong');
  });
  it('любой из допустимых вариантов', () => {
    expect(checkTyped('ok', ['okay', 'ok']).result).toBe('correct');
  });
});

describe('gradeAuto', () => {
  const fast = { elapsedMs: 3000, slowMs: 9000 };
  it('ошибка → Again, верно → Good, Easy автоматически не ставится', () => {
    expect(gradeAuto('wrong', fast)).toBe(Rating.Again);
    expect(gradeAuto('correct', fast)).toBe(Rating.Good);
  });
  it('почти, подсказка или медленно → Hard', () => {
    expect(gradeAuto('almost', fast)).toBe(Rating.Hard);
    expect(gradeAuto('correct', { ...fast, usedHint: true })).toBe(Rating.Hard);
    expect(gradeAuto('correct', { elapsedMs: 12000, slowMs: 9000 })).toBe(Rating.Hard);
  });
});
