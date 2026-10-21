"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Leader = { id: string; username: string; display_name: string; avatar: string; total_points: number };

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState<Leader[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ leaders: Leader[] }>("/api/leaderboard").then((d) => setLeaders(d.leaders)).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="heading text-center text-4xl">🏆 Hall of Fame</h1>
      {error && <p className="text-rose-300">{error}</p>}
      {!leaders ? (
        <p className="text-center text-slate-400">Loading…</p>
      ) : leaders.length === 0 ? (
        <p className="text-center text-slate-400">No points yet. Play a game to get on the board!</p>
      ) : (
        <ol className="space-y-2">
          {leaders.map((l, i) => (
            <li key={l.id} className="card flex items-center gap-4 py-3">
              <span className="w-8 text-center text-xl">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
              <span className="text-3xl">{l.avatar}</span>
              <span className="flex-1">
                <span className="font-semibold">{l.display_name}</span>
                <span className="ml-2 text-sm text-slate-400">@{l.username}</span>
              </span>
              <span className="font-mono text-lg">{l.total_points.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
