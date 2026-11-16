import { useEffect, useRef, useState } from "react";
import { say } from "../lib/speech";
import { unlockAudio } from "../lib/audio";

type Props = {
  text: string;
  rate?: number;
  size?: "sm" | "lg";
  label?: string;
};

/** 🔊 — тап: озвучить; долгое нажатие: медленно (0.75). */
export function SpeakButton({ text, rate, size = "sm", label }: Props) {
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const seq = useRef(0);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  function play(r?: number) {
    const current = ++seq.current;
    setError("");
    setBusy(true);
    say(text, { rate: r })
      .catch(() => {
        if (seq.current === current)
          setError(
            "Нет звука. Попробуй ещё раз или проверь голос в настройках.",
          );
      })
      .finally(() => {
        if (seq.current === current) setBusy(false);
      });
  }

  const big = size === "lg";
  return (
    <>
      <button
        type="button"
        aria-label={label ?? `Озвучить: ${text}. Долгое нажатие — медленно`}
        onPointerDown={() => {
          unlockAudio();
          longPressed.current = false;
          timer.current = window.setTimeout(() => {
            longPressed.current = true;
            play(0.75);
          }, 450);
        }}
        onPointerUp={() =>
          timer.current !== null && clearTimeout(timer.current)
        }
        onPointerLeave={() =>
          timer.current !== null && clearTimeout(timer.current)
        }
        onPointerCancel={() =>
          timer.current !== null && clearTimeout(timer.current)
        }
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (!longPressed.current) play(rate);
        }}
        className={`grid shrink-0 select-none place-items-center rounded-full bg-accent-soft text-accent transition-transform active:scale-95 ${
          big ? "h-28 w-28 text-5xl" : "h-12 w-12 text-xl"
        } ${busy ? "ring-4 ring-accent/30" : ""}`}
        style={{ WebkitTouchCallout: "none" }}
      >
        🔊
      </button>
      {error && (
        <span role="status" className="text-xs text-bad">
          {error}
        </span>
      )}
    </>
  );
}
