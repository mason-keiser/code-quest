"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { CHOICE_STYLES } from "@/lib/constants";
import { CodeBlock } from "./CodeBlock";
import type { Question, QuestionType } from "@/lib/types";

export interface QuizDraft {
  id?: string;
  title: string;
  description: string;
  topic: string;
  grade_level: string;
  is_public: boolean;
  questions: Question[];
}

const blankQuestion = (type: QuestionType = "multiple_choice"): Question => ({
  type,
  prompt: "",
  code_snippet: type === "code_output" ? "" : null,
  code_language: type === "code_output" ? "python" : null,
  choices: type === "true_false" ? ["True", "False"] : ["", "", "", ""],
  correct_index: 0,
  time_limit: type === "code_output" ? 30 : 20,
  points: 1000,
  image_url: null,
});

const emptyQuiz = (): QuizDraft => ({
  title: "",
  description: "",
  topic: "",
  grade_level: "",
  is_public: false,
  questions: [blankQuestion()],
});

const LANGUAGES = ["python", "javascript", "java", "c", "cpp", "html", "css", "sql"];

export function QuizEditor({ initial }: { initial?: QuizDraft }) {
  const router = useRouter();
  const [quiz, setQuiz] = useState<QuizDraft>(() => initial ?? emptyQuiz());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<QuizDraft>) => setQuiz((q) => ({ ...q, ...patch }));
  const updateQ = (i: number, patch: Partial<Question>) =>
    setQuiz((q) => ({ ...q, questions: q.questions.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const move = (i: number, dir: -1 | 1) =>
    setQuiz((q) => {
      const qs = [...q.questions];
      const j = i + dir;
      if (j < 0 || j >= qs.length) return q;
      [qs[i], qs[j]] = [qs[j], qs[i]];
      return { ...q, questions: qs };
    });

  const save = async () => {
    setSaving(true);
    setError(null);
    // Drop empty optional choices (keeping the correct one in range) before saving.
    const cleaned = quiz.questions.map((x) => {
      const keep = x.choices.map((c, k) => ({ c, k })).filter(({ c, k }) => c.trim() || k < 2 || k === x.correct_index);
      return { ...x, choices: keep.map((o) => o.c), correct_index: keep.findIndex((o) => o.k === x.correct_index) };
    });
    const body = {
      ...quiz,
      questions: cleaned.map((q) => ({
        ...q,
        code_snippet: q.type === "code_output" ? q.code_snippet : q.code_snippet || null,
        image_url: q.image_url || null,
      })),
    };
    try {
      if (quiz.id) await api(`/api/quizzes/${quiz.id}`, { method: "PUT", body });
      else await api("/api/quizzes", { body });
      router.push("/dashboard");
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AiPanel
        defaults={{ topic: quiz.topic, grade_level: quiz.grade_level }}
        onDraft={(draft, replace) =>
          setQuiz((q) => ({
            ...q,
            title: q.title || draft.title,
            description: q.description || draft.description,
            topic: q.topic || draft.topic,
            grade_level: q.grade_level || draft.grade_level,
            questions: replace ? draft.questions : [...q.questions.filter((x) => x.prompt.trim()), ...draft.questions],
          }))
        }
      />

      <section className="card grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label" htmlFor="title">Quiz title</label>
          <input id="title" className="input text-lg" value={quiz.title} onChange={(e) => update({ title: e.target.value })} placeholder="Python Loops Lightning Round" />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="desc">Description</label>
          <input id="desc" className="input" value={quiz.description} onChange={(e) => update({ description: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="topic">Topic</label>
          <input id="topic" className="input" value={quiz.topic} onChange={(e) => update({ topic: e.target.value })} placeholder="for loops" />
        </div>
        <div>
          <label className="label" htmlFor="grade">Grade level</label>
          <input id="grade" className="input" value={quiz.grade_level} onChange={(e) => update({ grade_level: e.target.value })} placeholder="Grades 6–8" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={quiz.is_public} onChange={(e) => update({ is_public: e.target.checked })} className="size-4 accent-indigo-500" />
          Share in the instructor library so other teachers can host it
        </label>
      </section>

      {quiz.questions.map((q, i) => (
        <section key={i} className="card space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="heading text-lg">Q{i + 1}</span>
            <select
              className="input w-auto"
              value={q.type}
              onChange={(e) => {
                const type = e.target.value as QuestionType;
                updateQ(i, { ...blankQuestion(type), prompt: q.prompt, id: q.id });
              }}
            >
              <option value="multiple_choice">Multiple choice</option>
              <option value="true_false">True / False</option>
              <option value="code_output">What does this code print?</option>
            </select>
            <label className="flex items-center gap-1 text-sm text-slate-300">
              ⏱️
              <input type="number" min={5} max={120} className="input w-20" value={q.time_limit} onChange={(e) => updateQ(i, { time_limit: Number(e.target.value) })} />s
            </label>
            <label className="flex items-center gap-1 text-sm text-slate-300">
              ⭐
              <select className="input w-auto" value={q.points} onChange={(e) => updateQ(i, { points: Number(e.target.value) })}>
                <option value={0}>No points</option>
                <option value={1000}>Standard</option>
                <option value={2000}>Double</option>
              </select>
            </label>
            <div className="ml-auto flex gap-1">
              <button onClick={() => move(i, -1)} className="btn-secondary px-2 text-sm" disabled={i === 0} aria-label="Move up">↑</button>
              <button onClick={() => move(i, 1)} className="btn-secondary px-2 text-sm" disabled={i === quiz.questions.length - 1} aria-label="Move down">↓</button>
              <button
                onClick={() => setQuiz((x) => ({ ...x, questions: x.questions.filter((_, j) => j !== i) }))}
                className="btn-secondary px-2 text-sm"
                disabled={quiz.questions.length === 1}
                aria-label="Delete question"
              >
                🗑️
              </button>
            </div>
          </div>

          <textarea className="input min-h-16" value={q.prompt} onChange={(e) => updateQ(i, { prompt: e.target.value })} placeholder="Type your question…" />

          {q.type === "code_output" && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <select className="input w-auto" value={q.code_language ?? "python"} onChange={(e) => updateQ(i, { code_language: e.target.value })}>
                  {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
                </select>
                <textarea
                  className="input min-h-36 font-mono text-sm"
                  value={q.code_snippet ?? ""}
                  onChange={(e) => updateQ(i, { code_snippet: e.target.value })}
                  placeholder={'for i in range(3):\n    print(i)'}
                  spellCheck={false}
                />
              </div>
              <div>
                <span className="label">Preview</span>
                <CodeBlock code={q.code_snippet || "# your code here"} language={q.code_language} />
              </div>
            </div>
          )}

          <input className="input text-sm" value={q.image_url ?? ""} onChange={(e) => updateQ(i, { image_url: e.target.value })} placeholder="Optional image URL" />

          <div className="grid gap-2 sm:grid-cols-2">
            {q.choices.map((c, ci) => (
              <div key={ci} className={`flex items-center gap-2 rounded-xl p-2 ${CHOICE_STYLES[ci].bg} ${q.correct_index === ci ? "ring-4 ring-white" : "opacity-80"}`}>
                <button
                  onClick={() => updateQ(i, { correct_index: ci })}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-black/25 text-white"
                  title="Mark as correct"
                  aria-label={`Mark choice ${ci + 1} correct`}
                >
                  {q.correct_index === ci ? "✓" : CHOICE_STYLES[ci].shape}
                </button>
                <input
                  className={`w-full rounded-lg bg-black/20 px-2 py-1.5 text-white placeholder:text-white/60 focus:outline-none ${q.type === "code_output" ? "font-mono" : ""}`}
                  value={c}
                  disabled={q.type === "true_false"}
                  onChange={(e) => updateQ(i, { choices: q.choices.map((x, k) => (k === ci ? e.target.value : x)) })}
                  placeholder={`Answer ${ci + 1}${ci >= 2 ? " (optional)" : ""}`}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">Click a shape to mark the correct answer. Leave answers 3–4 blank to use only two.</p>
        </section>
      ))}

      <div className="flex flex-wrap gap-2">
        <button onClick={() => update({ questions: [...quiz.questions, blankQuestion()] })} className="btn-secondary">+ Multiple choice</button>
        <button onClick={() => update({ questions: [...quiz.questions, blankQuestion("true_false")] })} className="btn-secondary">+ True / False</button>
        <button onClick={() => update({ questions: [...quiz.questions, blankQuestion("code_output")] })} className="btn-secondary">+ Code output</button>
      </div>

      <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-2xl border border-white/10 bg-slate-900/90 p-3 backdrop-blur">
        {error && <p className="mr-auto text-sm text-rose-300">{error}</p>}
        <span className="text-sm text-slate-400">{quiz.questions.length} questions</span>
        <button onClick={() => router.back()} className="btn-secondary">Cancel</button>
        <button
          onClick={save}
          className="btn-primary"
          disabled={saving}
        >
          {saving ? "Saving…" : "Save quiz"}
        </button>
      </div>
    </div>
  );
}

function AiPanel({
  defaults,
  onDraft,
}: {
  defaults: { topic: string; grade_level: string };
  onDraft: (draft: Omit<QuizDraft, "is_public">, replace: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState(defaults.topic);
  const [grade, setGrade] = useState(defaults.grade_level || "Grades 6–8");
  const [count, setCount] = useState(8);
  const [language, setLanguage] = useState("Python");
  const [includeCode, setIncludeCode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (replace: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const { quiz } = await api<{ quiz: Omit<QuizDraft, "is_public"> }>("/api/quizzes/generate", {
        body: { topic, grade_level: grade, count, include_code: includeCode, language },
      });
      onDraft(quiz, replace);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="card flex w-full items-center gap-3 text-left transition hover:bg-white/10">
        <span className="text-3xl">✨</span>
        <span>
          <span className="heading block text-lg">Draft questions with AI</span>
          <span className="text-sm text-slate-400">Describe a topic and grade level. You can review and edit everything before saving.</span>
        </span>
      </button>
    );

  return (
    <section className="card space-y-4 border-indigo-400/40 bg-indigo-500/10">
      <h2 className="heading text-xl">✨ Draft questions with AI</h2>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="label" htmlFor="ai-topic">Topic</label>
          <input id="ai-topic" className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Python for-loops and range()" />
        </div>
        <div>
          <label className="label" htmlFor="ai-grade">Grade level</label>
          <input id="ai-grade" className="input" value={grade} onChange={(e) => setGrade(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="ai-count">Questions</label>
          <input id="ai-count" type="number" min={1} max={15} className="input" value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300 md:col-span-2">
          <input type="checkbox" checked={includeCode} onChange={(e) => setIncludeCode(e.target.checked)} className="size-4 accent-indigo-500" />
          Include code-reading questions in
          <select className="input w-auto py-1" value={language} onChange={(e) => setLanguage(e.target.value)} disabled={!includeCode}>
            {["Python", "JavaScript", "Java", "Scratch-style pseudocode", "HTML/CSS"].map((l) => <option key={l}>{l}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="text-sm text-rose-300">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => generate(false)} className="btn-primary" disabled={busy || topic.trim().length < 2}>
          {busy ? "Generating… (this can take ~30s)" : "Generate & add to quiz"}
        </button>
        <button onClick={() => generate(true)} className="btn-secondary" disabled={busy || topic.trim().length < 2}>Replace all questions</button>
        <button onClick={() => setOpen(false)} className="btn-secondary" disabled={busy}>Close</button>
      </div>
      <p className="text-xs text-slate-400">AI can make mistakes, so double-check answers (especially code output) before playing.</p>
    </section>
  );
}
