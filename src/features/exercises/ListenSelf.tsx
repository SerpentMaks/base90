import { useEffect, useRef, useState } from 'react';
import { word } from '../../content';
import { Rating, type Grade } from '../../lib/fsrs';
import { say } from '../../lib/speech';
import { useSettings } from '../../lib/settings';
import { SpeakButton } from '../../ui/SpeakButton';
import { BottomBar, btnPrimary, Prompt, type ExerciseProps } from './common';

/**
 * 6.2 На слух → значение, повторение: вспомни сам → «Показать» → самооценка.
 * «Легко» спрятано на долгое нажатие «Вспомнил», чтобы не переоценивать себя.
 */
export function ListenSelf({ itemId, onDone }: ExerciseProps) {
  const w = word(itemId);
  const { showIpa } = useSettings();
  const [shown, setShown] = useState(false);
  const start = useRef(performance.now());
  const elapsed = useRef(0);
  const press = useRef<number | null>(null);
  const easyFired = useRef(false);

  useEffect(() => {
    start.current = performance.now();
    void say(w.lemma).catch(() => {});
  }, [w.lemma]);

  function rate(grade: Grade) {
    onDone({ grade, correct: grade !== Rating.Again, elapsedMs: elapsed.current });
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <Prompt>Вспомни значение</Prompt>
      <div className="flex justify-center py-2">
        <SpeakButton text={w.lemma} size="lg" />
      </div>
      {shown && (
        <div className="text-center">
          <p lang="en" className="text-4xl font-bold">
            {w.lemma}
          </p>
          {showIpa && <p className="font-mono text-muted">{w.ipa}</p>}
          <p className="mt-3 text-2xl">{w.ru.join(', ')}</p>
          {w.examples[0] && (
            <p className="mt-3 text-sm text-muted">
              <span lang="en">{w.examples[0].en}</span> — {w.examples[0].ru}
            </p>
          )}
        </div>
      )}
      <BottomBar>
        {!shown ? (
          <button
            className={btnPrimary}
            onClick={() => {
              elapsed.current = performance.now() - start.current;
              setShown(true);
            }}
          >
            Показать ответ
          </button>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <button className="min-h-16 rounded-2xl bg-bad/15 px-1 text-[15px] leading-tight font-semibold text-bad" onClick={() => rate(Rating.Again)}>
                Не вспомнил
              </button>
              <button className="min-h-16 rounded-2xl bg-amber-500/15 px-1 text-[15px] leading-tight font-semibold text-amber-700 dark:text-amber-300" onClick={() => rate(Rating.Hard)}>
                С трудом
              </button>
              <button
                className="min-h-16 rounded-2xl bg-good/15 px-1 text-[15px] leading-tight font-semibold text-good select-none"
                style={{ WebkitTouchCallout: 'none' }}
                onContextMenu={(e) => e.preventDefault()}
                onPointerDown={() => {
                  easyFired.current = false;
                  press.current = window.setTimeout(() => {
                    easyFired.current = true;
                    rate(Rating.Easy);
                  }, 700);
                }}
                onPointerUp={() => press.current !== null && clearTimeout(press.current)}
                onPointerLeave={() => press.current !== null && clearTimeout(press.current)}
                onClick={() => !easyFired.current && rate(Rating.Good)}
              >
                Вспомнил
              </button>
            </div>
            <p className="text-center text-xs text-muted">Совсем легко? Удерживай «Вспомнил».</p>
          </>
        )}
      </BottomBar>
    </div>
  );
}
