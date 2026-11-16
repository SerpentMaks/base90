type Props = { value: number; max: number; size?: number; label: string; sublabel?: string };

/** Кольцо прогресса без обратного отсчёта. */
export function Ring({ value, max, size = 200, label, sublabel }: Props) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label} ${sublabel ?? ''}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          className="transition-[stroke-dashoffset] duration-200"
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-4xl font-semibold tabular-nums">{label}</div>
        {sublabel && <div className="mt-1 text-sm text-muted">{sublabel}</div>}
      </div>
    </div>
  );
}
