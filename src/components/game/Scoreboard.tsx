import type { PlayerSummary } from "@/lib/types";

const MEDALS = ["🥇", "🥈", "🥉"];

export function Scoreboard({ players, highlightId, limit = 10 }: { players: PlayerSummary[]; highlightId?: string; limit?: number }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const shown = sorted.slice(0, limit);
  const me = highlightId ? sorted.findIndex((p) => p.id === highlightId) : -1;

  return (
    <ol className="space-y-2">
      {shown.map((p, i) => (
        <li
          key={p.id}
          className={`animate-pop flex items-center gap-3 rounded-xl px-4 py-3 ${
            p.id === highlightId ? "bg-indigo-500/40 ring-2 ring-indigo-300" : "bg-white/5"
          }`}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <span className="w-8 text-center text-xl">{MEDALS[i] ?? i + 1}</span>
          <span className="text-2xl">{p.avatar}</span>
          <span className="flex-1 font-semibold">{p.nickname}</span>
          {p.streak >= 2 && <span className="badge bg-orange-500/30 text-orange-200">🔥 {p.streak}</span>}
          <span className="font-mono text-lg tabular-nums">{p.score.toLocaleString()}</span>
        </li>
      ))}
      {me >= limit && (
        <li className="flex items-center gap-3 rounded-xl bg-indigo-500/40 px-4 py-3 ring-2 ring-indigo-300">
          <span className="w-8 text-center">{me + 1}</span>
          <span className="text-2xl">{sorted[me].avatar}</span>
          <span className="flex-1 font-semibold">{sorted[me].nickname}</span>
          <span className="font-mono text-lg">{sorted[me].score.toLocaleString()}</span>
        </li>
      )}
    </ol>
  );
}
