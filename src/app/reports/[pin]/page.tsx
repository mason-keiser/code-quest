"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CodeBlock } from "@/components/CodeBlock";
import { CHOICE_STYLES } from "@/lib/constants";

interface QuestionStat {
  id: string;
  position: number;
  prompt: string;
  code_snippet: string | null;
  code_language: string | null;
  choices: string[];
  correct_index: number;
  answered: number;
  no_answer: number;
  correct: number;
  accuracy: number;
  avg_response_ms: number | null;
  choice_counts: number[];
}
interface StudentStat {
  id: string;
  rank: number;
  nickname: string;
  avatar: string;
  score: number;
  answered: number;
  correct: number;
  accuracy: number;
  missed_positions: number[];
}
interface Report {
  game: { pin: string; status: string; created_at: string; quiz_title: string };
  summary: { players: number; questions: number; class_accuracy: number };
  questions: QuestionStat[];
  most_missed: QuestionStat[];
  students: StudentStat[];
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const tone = (n: number) => (n >= 0.8 ? "text-emerald-300" : n >= 0.5 ? "text-amber-300" : "text-rose-300");

export default function ReportPage() {
  const { pin } = useParams<{ pin: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Report>(`/api/games/${pin}/report`).then(setReport).catch((e) => setError(e.message));
  }, [pin]);

  if (error) return <p className="text-rose-300">{error}</p>;
  if (!report) return <p className="text-slate-400">Loading report…</p>;

  const exportCsv = () => {
    const header = ["Rank", "Nickname", "Score", "Correct", "Answered", "Accuracy", "Missed questions"];
    const rows = report.students.map((s) => [s.rank, s.nickname, s.score, s.correct, s.answered, pct(s.accuracy), s.missed_positions.join(" ")]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `codequest-${report.game.pin}.csv`;
    a.click();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="heading text-3xl">📊 {report.game.quiz_title}</h1>
          <p className="text-slate-400">Game {report.game.pin} · {new Date(report.game.created_at).toLocaleString()}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={exportCsv} className="btn-secondary">Export CSV</button>
          <Link href="/dashboard" className="btn-secondary">Dashboard</Link>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Players" value={String(report.summary.players)} />
        <Stat label="Questions" value={String(report.summary.questions)} />
        <Stat label="Class accuracy" value={pct(report.summary.class_accuracy)} className={tone(report.summary.class_accuracy)} />
      </section>

      {report.most_missed.length > 0 && (
        <section className="card border-rose-400/30 bg-rose-500/5">
          <h2 className="heading mb-1 text-xl">🎯 Worth reteaching</h2>
          <p className="mb-4 text-sm text-slate-400">The questions your class found hardest, with the most popular wrong answer.</p>
          <div className="grid gap-4 md:grid-cols-3">
            {report.most_missed.map((q) => {
              const wrong = q.choice_counts
                .map((n, i) => ({ n, i }))
                .filter((x) => x.i !== q.correct_index)
                .sort((a, b) => b.n - a.n)[0];
              return (
                <div key={q.id} className="rounded-xl bg-white/5 p-4">
                  <p className="text-sm text-slate-400">Q{q.position + 1} · <span className={tone(q.accuracy)}>{pct(q.accuracy)} correct</span></p>
                  <p className="mt-1 font-semibold">{q.prompt}</p>
                  {wrong?.n > 0 && (
                    <p className="mt-2 text-sm text-slate-300">
                      Common mistake: <span className="font-mono text-rose-200">{q.choices[wrong.i]}</span> ({wrong.n})
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="heading mb-4 text-xl">Question breakdown</h2>
        <div className="space-y-6">
          {report.questions.map((q) => {
            const max = Math.max(1, ...q.choice_counts);
            return (
              <div key={q.id} className="grid gap-4 border-b border-white/10 pb-6 last:border-0 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm text-slate-400">
                    Q{q.position + 1} · <span className={tone(q.accuracy)}>{pct(q.accuracy)} correct</span>
                    {q.avg_response_ms != null && ` · avg ${(q.avg_response_ms / 1000).toFixed(1)}s`}
                    {q.no_answer > 0 && ` · ${q.no_answer} no answer`}
                  </p>
                  <p className="font-semibold">{q.prompt}</p>
                  {q.code_snippet && <CodeBlock code={q.code_snippet} language={q.code_language} className="text-xs" />}
                </div>
                <div className="space-y-2">
                  {q.choices.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-40 truncate font-mono text-sm" title={c}>
                        {i === q.correct_index ? "✓ " : ""}{c}
                      </span>
                      <div className="h-6 flex-1 overflow-hidden rounded-md bg-white/5">
                        <div
                          className={`h-full ${CHOICE_STYLES[i].bg} ${i === q.correct_index ? "" : "opacity-50"}`}
                          style={{ width: `${(q.choice_counts[i] / max) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 text-right font-mono text-sm">{q.choice_counts[i]}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="heading mb-4 text-xl">Students</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-400">
            <tr><th className="py-2">#</th><th>Student</th><th>Score</th><th>Correct</th><th>Accuracy</th><th>Missed</th></tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {report.students.map((s) => (
              <tr key={s.id}>
                <td className="py-2">{s.rank}</td>
                <td>{s.avatar} {s.nickname}</td>
                <td className="font-mono">{s.score.toLocaleString()}</td>
                <td>{s.correct} / {report.summary.questions}</td>
                <td className={tone(s.accuracy)}>{pct(s.accuracy)}</td>
                <td className="text-slate-400">{s.missed_positions.length ? s.missed_positions.map((p) => `Q${p}`).join(", ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="card text-center">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`heading font-mono text-4xl ${className}`}>{value}</p>
    </div>
  );
}
