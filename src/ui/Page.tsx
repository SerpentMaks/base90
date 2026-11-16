import type { ReactNode } from "react";
export function Page({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pt-4 pb-28">
      <header className="flex items-center gap-3">
        <a
          href="#/today"
          aria-label="На главную"
          className="grid h-12 w-12 place-items-center text-3xl"
        >
          ‹
        </a>
        <h1 className="text-2xl font-bold">{title}</h1>
      </header>
      {children}
    </main>
  );
}
export const panel = "rounded-2xl border border-line bg-surface p-4";
