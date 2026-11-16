import { describe, expect, it } from 'vitest';
import { audioKey, audioPath } from './audioKey';

describe('audioKey', () => {
  it('стабилен и не зависит от лишних пробелов и «умных» апострофов', () => {
    expect(audioKey('af_heart', "I don't know.")).toBe(audioKey('af_heart', "  I don’t   know. "));
    expect(audioKey('af_heart', 'know')).toMatch(/^[0-9a-f]{14}$/);
  });
  it('разные голоса и тексты → разные файлы', () => {
    expect(audioKey('af_heart', 'know')).not.toBe(audioKey('am_michael', 'know'));
    expect(audioKey('af_heart', 'know')).not.toBe(audioKey('af_heart', 'Know'));
    expect(audioPath('af_heart', 'go')).toMatch(/^audio\/af_heart\/[0-9a-f]{14}\.m4a$/);
  });
});
