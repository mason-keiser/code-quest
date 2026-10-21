export function TimerRing({ left, total, size = 72 }: { left: number; total: number; size?: number }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const frac = total ? left / total : 0;
  const color = frac > 0.5 ? "stroke-emerald-400" : frac > 0.2 ? "stroke-amber-400" : "stroke-rose-500";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} className="fill-none stroke-white/10" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={`fill-none transition-[stroke-dashoffset] duration-200 ${color}`}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-xl font-bold tabular-nums">
        {Math.ceil(left)}
      </span>
    </div>
  );
}
