import { useEffect, useMemo, useRef, useState } from 'react';
import { distractors, word } from '../../content';
import { gradeAuto, Rating, SLOW_MS } from '../../lib/fsrs';
import { say } from '../../lib/speech';
import { sfxCorrect, sfxWrong } from '../../lib/sfx';
import { SpeakButton } from '../../ui/SpeakButton';
import { BottomBar, btnPrimary, Prompt, Verdict, type ExerciseProps } from './common';

/** 6.2 На слух → значение, ранние шаги: только аудио, выбор из 4. */
export function ListenChoice({ itemId, onDone }: ExerciseProps) {
  const w = word(itemId);
  const options = useMemo(() => {
    const all = [w.ru[0]!, ...distractors(w)];
    return all.map((o) => [Math.random(), o] as const).sort((a, b) => a[0] - b[0]).map(([, o]) => o);
  }, [w]);
  const [picked, setPicked] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const start = useRef(performance.now());
  const elapsed = useRef(0);

  useEffect(() => {
    start.current = performance.now();
    void say(w.lemma).catch(() => {});
  }, [w.lemma]);

  const answered = picked !== null || gaveUp;
  const correct = picked === w.ru[0];

  function choose(o: string) {
    if (answered) return;
    elapsed.current = performance.now() - start.current;
    setPicked(o);
    if (o === w.ru[0]) sfxCorrect();
    else sfxWrong();
    void say(w.lemma).catch(() => {});
  }

  function finish() {
    const grade = gaveUp ? Rating.Again : gradeAuto(correct ? 'correct' : 'wrong', { elapsedMs: elapsed.current, slowMs: SLOW_MS['listen-choice'] });
    onDone({ grade, correct: !gaveUp && correct, elapsedMs: elapsed.current });
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <Prompt>Что это значит?</Prompt>
      <div className="flex justify-center py-2">
        <SpeakButton text={w.lemma} size="lg" />
      </div>
      {answered && (
        <p lang="en" className="text-center text-3xl font-bold">
          {w.lemma}
        </p>
      )}
      <div className="grid grid-cols-1 gap-2">
        {options.map((o) => {
          const isRight = o === w.ru[0];
          const state = !answered ? '' : isRight ? 'border-good bg-good/10' : o === picked ? 'border-bad bg-bad/10' : 'opacity-60';
          return (
            <button
              key={o}
              disabled={answered}
              onClick={() => choose(o)}
              className={`min-h-14 rounded-2xl border border-line bg-surface px-4 text-left text-lg transition-colors ${state}`}
            >
              {o}
            </button>
          );
        })}
      </div>
      {!answered && (
        <button
          className="min-h-12 text-muted"
          onClick={() => {
            elapsed.current = performance.now() - start.current;
            setGaveUp(true);
            void say(w.lemma).catch(() => {});
          }}
        >
          Не помню
        </button>
      )}
      {answered && (
        <Verdict kind={correct ? 'good' : 'bad'}>
          {correct ? 'Верно!' : (
            <>
              <b lang="en">{w.lemma}</b> — {w.ru.join(', ')}. Ошибка = сигнал памяти, что слово надо укрепить.
            </>
          )}
        </Verdict>
      )}
      <BottomBar>{answered && <button className={btnPrimary} onClick={finish} autoFocus>Дальше</button>}</BottomBar>
    </div>
  );
}
