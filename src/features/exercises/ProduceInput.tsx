import { useEffect, useRef, useState } from 'react';
import { POS_RU, word } from '../../content';
import { checkTyped } from '../../lib/answer';
import { gradeAuto, SLOW_MS, type AutoResult } from '../../lib/fsrs';
import { say } from '../../lib/speech';
import { sfxCorrect, sfxWrong } from '../../lib/sfx';
import { BottomBar, btnPrimary, btnSecondary, Prompt, Verdict, type ExerciseProps } from './common';

/** 6.3 RU → EN: напечатай слово. Опечатка в 1 букву = «почти» (Hard), подсказка тоже даёт Hard. */
export function ProduceInput({ itemId, onDone }: ExerciseProps) {
  const w = word(itemId);
  const [value, setValue] = useState('');
  const [hint, setHint] = useState(false);
  const [result, setResult] = useState<{ result: AutoResult; expected: string } | null>(null);
  const start = useRef(performance.now());
  const elapsed = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    start.current = performance.now();
    input.current?.focus();
  }, []);

  function check(answer = value) {
    if (result) return;
    elapsed.current = performance.now() - start.current;
    const r = checkTyped(answer, [w.lemma]);
    setResult(r);
    if (r.result === 'wrong') sfxWrong();
    else sfxCorrect();
    void say(w.lemma).catch(() => {});
  }

  function finish() {
    if (!result) return;
    const grade = gradeAuto(result.result, { elapsedMs: elapsed.current, slowMs: SLOW_MS.produce, usedHint: hint });
    onDone({ grade, correct: result.result !== 'wrong', elapsedMs: elapsed.current });
  }

  const ctx = w.examples[0];

  return (
    <div className="flex flex-1 flex-col gap-5">
      <Prompt>Как это по-английски?</Prompt>
      <div className="text-center">
        <p className="text-3xl font-semibold">{w.ru.join(', ')}</p>
        <p className="mt-1 text-sm text-muted">{w.pos.map((p) => POS_RU[p] ?? p).join(', ')}</p>
        {ctx && <p className="mt-3 text-muted">Пример: «{ctx.ru}»</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (result) finish();
          else check();
        }}
        className="flex flex-col gap-3"
      >
        <input
          ref={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          readOnly={!!result}
          lang="en"
          inputMode="text"
          enterKeyHint={result ? 'next' : 'done'}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-label="Ответ по-английски"
          placeholder={hint ? `${w.lemma[0]}…` : 'напечатай слово'}
          className="min-h-14 w-full rounded-2xl border border-line bg-surface px-4 text-center text-2xl outline-none focus:border-accent"
        />
        {result && (
          <Verdict kind={result.result === 'correct' ? 'good' : result.result === 'almost' ? 'almost' : 'bad'}>
            {result.result === 'correct' && 'Верно!'}
            {result.result === 'almost' && (
              <>
                Почти! Правильно: <b lang="en">{result.expected}</b>
              </>
            )}
            {result.result === 'wrong' && (
              <>
                Правильно: <b lang="en">{result.expected}</b>
                {value.trim() && (
                  <>
                    {' '}
                    (у тебя: <s lang="en">{value.trim()}</s>)
                  </>
                )}
              </>
            )}
          </Verdict>
        )}
        {!result && !hint && (
          <button type="button" className="min-h-12 text-sm text-accent" onClick={() => setHint(true)}>
            Подсказка: первая буква
          </button>
        )}
        <BottomBar>
          {result ? (
            <button type="submit" className={btnPrimary}>
              Дальше
            </button>
          ) : (
            <>
              <button type="submit" className={btnPrimary} disabled={!value.trim()}>
                Проверить
              </button>
              <button type="button" className={btnSecondary} onClick={() => { setValue(''); check(''); }}>
                Не помню
              </button>
            </>
          )}
        </BottomBar>
      </form>
    </div>
  );
}
