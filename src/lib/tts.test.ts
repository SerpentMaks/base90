import { describe, expect, it } from 'vitest';
import { usVoices, voiceQuality } from './tts';

const v = (name: string, voiceURI = `com.apple.voice.compact.en-US.${name}`, lang = 'en-US') => ({
  name,
  lang,
  voiceURI,
  localService: true,
});

// Примерно то, что отдаёт iOS 17/18 без скачанных голосов.
const IOS = [
  v('Albert', 'com.apple.speech.synthesis.voice.Albert'),
  v('Bad News', 'com.apple.speech.synthesis.voice.BadNews'),
  v('Bahh', 'com.apple.speech.synthesis.voice.Bahh'),
  v('Bells', 'com.apple.speech.synthesis.voice.Bells'),
  v('Eddy (английский (США))', 'com.apple.eloquence.en-US.Eddy'),
  v('Flo (английский (США))', 'com.apple.eloquence.en-US.Flo'),
  v('Fred', 'com.apple.speech.synthesis.voice.Fred'),
  v('Samantha'),
  v('Zarvox', 'com.apple.speech.synthesis.voice.Zarvox'),
  v('Daniel', 'com.apple.voice.compact.en-GB.Daniel', 'en-GB'),
];

describe('выбор голоса', () => {
  it('iOS 18+: без Samantha первой идёт Eloquence (Flo), а не Albert/Fred', () => {
    const ios18 = IOS.filter((x) => x.name !== 'Samantha');
    expect(usVoices(ios18)[0]?.name).toBe('Flo (английский (США))');
    expect(voiceQuality(usVoices(ios18)[0]!)).toBe('basic');
  });
  it('без скачанных голосов первой идёт Samantha, а не Albert/Bad News', () => {
    expect(usVoices(IOS)[0]?.name).toBe('Samantha');
  });
  it('«приколы» убраны, британские голоса не попадают', () => {
    const names = usVoices(IOS).map((x) => x.name);
    expect(names).not.toContain('Bad News');
    expect(names).not.toContain('Zarvox');
    expect(names).not.toContain('Daniel');
  });
  it('роботизированные — в конце списка', () => {
    const list = usVoices(IOS);
    expect(voiceQuality(list[list.length - 1]!)).toBe('robotic');
  });
  it('скачанный премиум/улучшенный голос побеждает стандартный', () => {
    const list = usVoices([...IOS, v('Ava (улучшенный)', 'com.apple.voice.enhanced.en-US.Ava'), v('Zoe (Premium)', 'com.apple.voice.premium.en-US.Zoe')]);
    expect(list[0]?.name).toBe('Zoe (Premium)');
    expect(list[1]?.name).toBe('Ava (улучшенный)');
  });
  it('если есть только «приколы» — всё равно что-то возвращаем', () => {
    expect(usVoices([v('Bells', 'x.Bells')])).toHaveLength(1);
  });
});
