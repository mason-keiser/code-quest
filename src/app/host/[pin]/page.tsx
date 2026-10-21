"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useCountdown, useGame } from "@/components/game/useGame";
import { QuestionView } from "@/components/game/QuestionView";
import { Scoreboard } from "@/components/game/Scoreboard";
import { TimerRing } from "@/components/game/TimerRing";

export default function HostPage() {
  const { pin } = useParams<{ pin: string }>();
  const { state, error, refresh, serverNow } = useGame(pin);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const q = state?.question;
  const left = useCountdown(q?.started_at, q?.time_limit ?? 0, serverNow);

  const act = async (action: "start" | "reveal" | "next" | "end") => {
    setBusy(true);
    setActionError(null);
    try {
      await api(`/api/games/${pin}`, { method: "PATCH", body: { action } });
      await refresh();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Auto-reveal when time runs out or everyone has answered.
  const autoRevealed = useRef<string | null>(null);
  const everyoneAnswered = !!state && state.players.length > 0 && state.answered_count >= state.players.length;
  useEffect(() => {
    if (state?.status !== "question" || !q || autoRevealed.current === q.id) return;
    if (left <= 0 || everyoneAnswered) {
      autoRevealed.current = q.id;
      setTimeout(() => act("reveal"), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, everyoneAnswered, state?.status, q?.id]);

  if (error && !state) return <Centered>{error}</Centered>;
  if (!state) return <Centered>Loading game…</Centered>;
  if (!state.is_host) return <Centered>Only the host can view this screen.</Centered>;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/dashboard" className="btn-secondary text-sm">← Dashboard</Link>
        <h1 className="heading text-xl">{state.quiz_title}</h1>
        <span className="badge">PIN {state.pin}</span>
        <span className="badge">👥 {state.players.length}</span>
        {state.status !== "finished" && (
          <button onClick={() => confirm("End the game now? Points earned so far will be saved.") && act("end")} className="btn-danger ml-auto text-sm" disabled={busy}>
            End game
          </button>
        )}
      </header>
      {actionError && <p className="rounded-xl bg-rose-500/20 px-4 py-2 text-rose-200">{actionError}</p>}

      {state.status === "lobby" && (
        <section className="flex flex-1 flex-col items-center gap-8 text-center">
          <div className="card w-full max-w-2xl">
            <p className="text-slate-300">
              Join at <span className="font-semibold text-white">{window.location.host}</span> with game PIN
            </p>
            <p className="heading mt-2 font-mono text-7xl tracking-widest text-indigo-300">{state.pin}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {state.players.length === 0 && <p className="text-slate-400">Waiting for players to join…</p>}
            {state.players.map((p) => (
              <button
                key={p.id}
                title="Remove player"
                onClick={() => api(`/api/games/${pin}/players?id=${p.id}`, { method: "DELETE" }).then(refresh)}
                className="animate-pop rounded-full bg-white/10 px-4 py-2 text-lg hover:bg-rose-500/40"
              >
                {p.avatar} {p.nickname}
              </button>
            ))}
          </div>
          <button onClick={() => act("start")} disabled={busy || state.players.length === 0} className="btn-primary px-10 py-4 text-xl">
            Start game ▶
          </button>
        </section>
      )}

      {(state.status === "question" || state.status === "reveal") && q && (
        <section className="flex flex-1 flex-col gap-6">
          <div className="flex items-center justify-between">
            <span className="badge text-sm">Question {q.index + 1} / {q.total}</span>
            {state.status === "question" ? (
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="font-mono text-3xl font-bold">{state.answered_count}</p>
                  <p className="text-xs text-slate-400">answers</p>
                </div>
                <TimerRing left={left} total={q.time_limit} size={84} />
                <button onClick={() => act("reveal")} disabled={busy} className="btn-secondary">Skip timer</button>
              </div>
            ) : (
              <button onClick={() => act("next")} disabled={busy} className="btn-primary px-8 py-3 text-lg">
                {q.index + 1 === q.total ? "Final results 🏆" : "Next question →"}
              </button>
            )}
          </div>
          <QuestionView question={q} large />
          {state.status === "reveal" && (
            <div className="card mx-auto w-full max-w-2xl">
              <h3 className="heading mb-3 text-xl">Leaderboard</h3>
              <Scoreboard players={state.players} limit={5} />
            </div>
          )}
        </section>
      )}

      {state.status === "finished" && (
        <section className="flex flex-1 flex-col items-center gap-8">
          <h2 className="heading text-5xl">🏆 Final Results</h2>
          <Podium players={state.players} />
          <div className="w-full max-w-2xl">
            <Scoreboard players={state.players} limit={20} />
          </div>
          <div className="flex gap-3">
            <Link href={`/reports/${pin}`} className="btn-primary">View class report 📊</Link>
            <Link href="/dashboard" className="btn-secondary">Back to dashboard</Link>
          </div>
        </section>
      )}
    </div>
  );
}

function Podium({ players }: { players: { id: string; nickname: string; avatar: string; score: number }[] }) {
  const top = [...players].sort((a, b) => b.score - a.score).slice(0, 3);
  const order = [top[1], top[0], top[2]];
  const heights = ["h-28", "h-40", "h-20"];
  return (
    <div className="flex items-end gap-4">
      {order.map((p, i) =>
        p ? (
          <div key={p.id} className="animate-pop flex w-32 flex-col items-center gap-2" style={{ animationDelay: `${[300, 600, 0][i]}ms` }}>
            <span className="text-5xl">{p.avatar}</span>
            <span className="font-semibold">{p.nickname}</span>
            <span className="font-mono text-sm text-slate-300">{p.score.toLocaleString()}</span>
            <div className={`w-full rounded-t-xl bg-gradient-to-b from-indigo-400 to-indigo-700 ${heights[i]} flex items-start justify-center pt-2 text-3xl`}>
              {["🥈", "🥇", "🥉"][i]}
            </div>
          </div>
        ) : (
          <div key={i} className="w-32" />
        ),
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center text-lg text-slate-300">{children}</div>;
}
