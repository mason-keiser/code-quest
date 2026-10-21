"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useProfile } from "@/components/useProfile";
import { JoinByPin } from "@/components/JoinByPin";
import type { Profile, QuizSet } from "@/lib/types";

type QuizRow = QuizSet & { question_count: number; owner_name: string };
type GameRow = { id: string; pin: string; status: string; created_at: string; quiz_sets: { title: string } | null; game_players: { count: number }[] };
type HistoryRow = { score: number; joined_at: string; games: { pin: string; status: string; quiz_sets: { title: string } | null } };

export default function Dashboard() {
  const profile = useProfile();
  if (profile === undefined) return <p className="text-slate-400">Loading…</p>;
  if (profile === null) return <p>Please <Link href="/login" className="text-indigo-300">log in</Link>.</p>;
  return profile.role === "student" ? <StudentDashboard profile={profile} /> : <InstructorDashboard profile={profile} />;
}

function StudentDashboard({ profile }: { profile: Profile }) {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  useEffect(() => {
    api<{ history: HistoryRow[] }>("/api/me").then((d) => setHistory(d.history)).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="card flex items-center gap-4 md:col-span-2">
          <span className="text-6xl">{profile.avatar}</span>
          <div>
            <h1 className="heading text-3xl">Hey, {profile.display_name}!</h1>
            <p className="text-slate-300">Ready for your next CodeQuest?</p>
          </div>
        </div>
        <div className="card text-center">
          <p className="text-sm text-slate-400">Lifetime points</p>
          <p className="heading font-mono text-4xl text-indigo-300">{profile.total_points.toLocaleString()}</p>
          <Link href="/leaderboard" className="text-sm text-indigo-300 hover:underline">See leaderboard →</Link>
        </div>
      </section>

      <section className="card flex flex-col items-center gap-3 py-8">
        <h2 className="heading text-2xl">Join a game</h2>
        <p className="text-slate-400">Enter the PIN on your teacher&apos;s screen.</p>
        <JoinByPin large />
      </section>

      <section className="card">
        <h2 className="heading mb-3 text-xl">Recent games</h2>
        {history.length === 0 ? (
          <p className="text-slate-400">No games yet. Your scores will show up here.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {history.map((h, i) => (
              <li key={i} className="flex items-center justify-between py-2">
                <span>{h.games.quiz_sets?.title ?? "Quiz"}</span>
                <span className="text-sm text-slate-400">{new Date(h.joined_at).toLocaleDateString()}</span>
                <span className="font-mono">{h.score.toLocaleString()} pts</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function InstructorDashboard({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizRow[] | null>(null);
  const [games, setGames] = useState<GameRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ quizzes: QuizRow[] }>("/api/quizzes").then((d) => setQuizzes(d.quizzes)).catch((e) => setError(e.message));
    api<{ games: GameRow[] }>("/api/games").then((d) => setGames(d.games)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const host = async (quizId: string) => {
    try {
      const { game } = await api<{ game: { pin: string } }>("/api/games", { body: { quiz_set_id: quizId } });
      router.push(`/host/${game.pin}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (q: QuizRow) => {
    if (!confirm(`Delete "${q.title}"? This also deletes its game history.`)) return;
    await api(`/api/quizzes/${q.id}`, { method: "DELETE" }).catch((e) => setError(e.message));
    load();
  };

  const mine = quizzes?.filter((q) => q.owner_id === profile.id) ?? [];
  const shared = quizzes?.filter((q) => q.owner_id !== profile.id) ?? [];

  const QuizCard = ({ q, owned }: { q: QuizRow; owned: boolean }) => (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="heading text-lg">{q.title}</h3>
        {q.is_public && <span className="badge">Public</span>}
      </div>
      <p className="line-clamp-2 flex-1 text-sm text-slate-400">{q.description || q.topic || "No description"}</p>
      <div className="flex flex-wrap gap-2 text-xs text-slate-400">
        <span className="badge">{q.question_count} questions</span>
        {q.grade_level && <span className="badge">{q.grade_level}</span>}
        {!owned && <span className="badge">by {q.owner_name}</span>}
      </div>
      <div className="flex gap-2">
        <button onClick={() => host(q.id)} className="btn-primary flex-1 text-sm" disabled={!q.question_count}>▶ Host</button>
        {owned && <Link href={`/quizzes/${q.id}/edit`} className="btn-secondary text-sm">Edit</Link>}
        {owned && <button onClick={() => remove(q)} className="btn-secondary text-sm" aria-label="Delete">🗑️</button>}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="heading text-3xl">{profile.avatar} {profile.display_name}&apos;s classroom</h1>
        <Link href="/quizzes/new" className="btn-primary">+ New quiz</Link>
      </div>
      {error && <p className="rounded-xl bg-rose-500/20 px-4 py-2 text-rose-200">{error}</p>}

      <section>
        <h2 className="heading mb-3 text-xl">My quizzes</h2>
        {quizzes === null ? (
          <p className="text-slate-400">Loading…</p>
        ) : mine.length === 0 ? (
          <div className="card text-center text-slate-300">
            No quizzes yet. <Link href="/quizzes/new" className="text-indigo-300 hover:underline">Create one</Link>, or try the AI generator ✨
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{mine.map((q) => <QuizCard key={q.id} q={q} owned />)}</div>
        )}
      </section>

      {shared.length > 0 && (
        <section>
          <h2 className="heading mb-3 text-xl">Shared quiz library</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shared.map((q) => <QuizCard key={q.id} q={q} owned={profile.role === "admin"} />)}
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="heading mb-3 text-xl">Recent games</h2>
        {games.length === 0 ? (
          <p className="text-slate-400">Games you host will appear here with class reports.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr><th className="py-2">Quiz</th><th>PIN</th><th>Players</th><th>Status</th><th>Date</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {games.map((g) => (
                <tr key={g.id}>
                  <td className="py-2">{g.quiz_sets?.title}</td>
                  <td className="font-mono">{g.pin}</td>
                  <td>{g.game_players[0]?.count ?? 0}</td>
                  <td><span className="badge capitalize">{g.status}</span></td>
                  <td>{new Date(g.created_at).toLocaleDateString()}</td>
                  <td className="text-right">
                    {g.status === "finished" ? (
                      <Link href={`/reports/${g.pin}`} className="text-indigo-300 hover:underline">Report →</Link>
                    ) : (
                      <Link href={`/host/${g.pin}`} className="text-indigo-300 hover:underline">Resume →</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
