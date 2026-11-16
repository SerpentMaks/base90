import type { ReactNode } from 'react';
import type { Grade } from '../../lib/fsrs';

export type ExerciseResult = { grade: Grade | null; correct: boolean | null; elapsedMs: number };
export type ExerciseProps = { itemId: string; onDone: (r: ExerciseResult) => void };

export const btnPrimary =
  'min-h-14 w-full rounded-2xl bg-accent px-4 text-lg font-semibold text-accent-ink transition-transform active:scale-[0.98] disabled:opacity-50';
export const btnSecondary =
  'min-h-14 w-full rounded-2xl border border-line bg-surface px-4 text-lg font-medium transition-transform active:scale-[0.98]';

export function Prompt({ children }: { children: ReactNode }) {
  return <p className="text-center text-sm font-medium tracking-wide text-muted uppercase">{children}</p>;
}

/** Плашка обратной связи после ответа. */
export function Verdict({ kind, children }: { kind: 'good' | 'almost' | 'bad'; children: ReactNode }) {
  const cls =
    kind === 'good'
      ? 'border-good/40 bg-good/10 text-good'
      : kind === 'almost'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : 'border-bad/40 bg-bad/10 text-bad';
  return (
    <div role="status" className={`rounded-2xl border p-4 ${cls}`}>
      {children}
    </div>
  );
}

/** Нижняя зона под большой палец: кнопки всегда внизу экрана. */
export function BottomBar({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex flex-col gap-3 pt-4">{children}</div>;
}
