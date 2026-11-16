import { useEffect, useRef, useState } from 'react';
import { WORD_ORDER } from '../../content';
import { repo } from '../../db/repo';
import { afterAnswer, buildSession, nextTask, remaining, type SessionState, type Task } from '../../lib/session';
import { stopSpeech } from '../../lib/speech';
import { studyDate } from '../../lib/time';
import { Intro } from '../exercises/Intro';
import { ListenChoice } from '../exercises/ListenChoice';
import { ListenSelf } from '../exercises/ListenSelf';
import { ProduceInput } from '../exercises/ProduceInput';
import type { ExerciseResult } from '../exercises/common';
import { Summary } from './Summary';

/** Сколько новых слов за один заход (этап 2; на этапе 4 это посчитает дневной план). */
export const NEW_PER_SESSION = 5;

/** Начать новую сессию или продолжить сохранённую (если она сегодняшняя и не закончена). */
async function openSession(fresh: boolean): Promise<SessionState> {
  const today = studyDate();
  const saved = fresh ? null : await repo().loadSession();
  if (saved && saved.studyDate === today && remaining(saved) > 0) return saved;
  const cards = await repo().allCards();
  return buildSession({ cards, wordOrder: WORD_ORDER, now: Date.now(), newLimit: NEW_PER_SESSION, studyDate: today });
}

export function SessionScreen({ fresh, onExit }: { fresh: boolean; onExit: () => void }) {
  const session = useRef<SessionState | null>(null);
  const [task, setTask] = useState<Task | null | 'loading'>('loading');
  const [step, setStep] = useState(0);
  const [total, setTotal] = useState(1);
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    void openSession(fresh).then(async (s) => {
      if (!alive) return;
      session.current = s;
      // Перезагрузка (или iOS, восстановивший приложение) должна продолжить эту сессию, а не начать новую.
      if (window.location.hash !== '#/session') history.replaceState(null, '', '#/session');
      const t = nextTask(s, Date.now());
      setTotal(remaining(s) + (t ? 1 : 0) + s.answered + s.introduced.length);
      setStep(s.answered + s.introduced.length);
      setTask(t);
      await repo().saveSession(t ? { ...s, queue: [t, ...s.queue] } : null);
    });
    return () => {
      alive = false;
      stopSpeech();
    };
  }, [fresh]);

  async function handleDone(t: Task, r: ExerciseResult) {
    const s = session.current;
    if (!s || busy.current) return;
    busy.current = true;
    stopSpeech();
    try {
      const now = new Date();
      let updated = null;
      if (t.type === 'intro') {
        await repo().introduce(t.itemId, now);
      } else if (r.grade !== null) {
        const card = await repo().getCard(t.type === 'produce' ? 'produce' : 'listen', t.itemId);
        if (card) updated = await repo().answer(card, r.grade, { now, elapsedMs: r.elapsedMs, exerciseType: t.type });
      }
      afterAnswer(s, t, updated, r.correct, now.getTime());
      const next = nextTask(s, Date.now());
      // Сохраняем вместе с текущим заданием в начале очереди — «Продолжить» вернёт сюда же.
      await repo().saveSession(next ? { ...s, queue: [next, ...s.queue] } : null);
      setStep((n) => n + 1);
      setTotal((n) => Math.max(n, step + 1 + remaining(s) + (next ? 1 : 0)));
      setTask(next);
    } finally {
      busy.current = false;
    }
  }

  if (task === 'loading') return <div className="p-6 text-center text-muted">Загрузка…</div>;

  const progress = Math.min(1, step / Math.max(1, total));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-6">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-bg pt-3 pb-2">
        <button
          onClick={() => {
            stopSpeech();
            onExit();
          }}
          aria-label="Пауза — прогресс сохранится"
          className="grid h-12 w-12 place-items-center rounded-full text-2xl text-muted"
        >
          ✕
        </button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
        </div>
      </header>

      <div className="flex flex-1 flex-col pt-4">
        {task === null ? (
          <Summary session={session.current} onExit={onExit} />
        ) : (
          <Exercise key={`${step}:${task.type}:${task.itemId}`} task={task} onDone={(r) => void handleDone(task, r)} />
        )}
      </div>
    </main>
  );
}

function Exercise({ task, onDone }: { task: Task; onDone: (r: ExerciseResult) => void }) {
  switch (task.type) {
    case 'intro':
      return <Intro itemId={task.itemId} onDone={onDone} />;
    case 'listen-choice':
      return <ListenChoice itemId={task.itemId} onDone={onDone} />;
    case 'listen-self':
      return <ListenSelf itemId={task.itemId} onDone={onDone} />;
    case 'produce':
      return <ProduceInput itemId={task.itemId} onDone={onDone} />;
  }
}
