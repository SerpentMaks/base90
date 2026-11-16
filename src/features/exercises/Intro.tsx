import { useEffect } from 'react';
import { POS_RU, word } from '../../content';
import { say } from '../../lib/speech';
import { useSettings } from '../../lib/settings';
import { SpeakButton } from '../../ui/SpeakButton';
import { BottomBar, btnPrimary, type ExerciseProps } from './common';

/** 6.1 Знакомство со словом: без оценки, дальше — шаги изучения. */
export function Intro({ itemId, onDone }: ExerciseProps) {
  const w = word(itemId);
  const { autoplay, showIpa } = useSettings();

  useEffect(() => {
    if (autoplay) void say(w.lemma).catch(() => {});
  }, [w.lemma, autoplay]);

  return (
    <div className="flex flex-1 flex-col gap-5">
      <p className="text-center text-sm font-medium text-accent">Новое слово</p>
      <div className="flex items-center justify-center gap-4">
        <div className="text-center">
          <h2 lang="en" className="text-5xl font-bold">
            {w.lemma}
          </h2>
          {showIpa && <p className="mt-1 font-mono text-lg text-muted">{w.ipa}</p>}
        </div>
        <SpeakButton text={w.lemma} />
      </div>
      <p className="text-center text-sm text-muted">{w.pos.map((p) => POS_RU[p] ?? p).join(', ')}</p>
      <p className="text-center text-2xl">
        <b>{w.ru[0]}</b>
        {w.ru.length > 1 && <span className="text-muted">, {w.ru.slice(1).join(', ')}</span>}
      </p>

      {w.note && (
        <p className="rounded-2xl bg-amber-500/10 p-3 text-sm">
          <span aria-hidden>💡 </span>
          {w.note}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {w.examples.map((e) => (
          <li key={e.en} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
            <SpeakButton text={e.en} rate={0.85} />
            <div>
              <p lang="en" className="font-medium">
                {e.en}
              </p>
              <p className="text-sm text-muted">{e.ru}</p>
            </div>
          </li>
        ))}
      </ul>

      <BottomBar>
        <button className={btnPrimary} onClick={() => onDone({ grade: null, correct: null, elapsedMs: 0 })}>
          Понятно, дальше
        </button>
      </BottomBar>
    </div>
  );
}
