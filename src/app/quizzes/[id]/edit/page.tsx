"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { QuizEditor, type QuizDraft } from "@/components/QuizEditor";

export default function EditQuizPage() {
  const { id } = useParams<{ id: string }>();
  const [quiz, setQuiz] = useState<QuizDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ quiz: QuizDraft }>(`/api/quizzes/${id}`)
      .then((d) => {
        // Pad choices back to 4 so the editor always shows four answer slots.
        const questions = d.quiz.questions.map((q) =>
          q.type === "true_false" ? q : { ...q, choices: [...q.choices, "", "", ""].slice(0, Math.max(4, q.choices.length)) },
        );
        setQuiz({ ...d.quiz, questions });
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="text-rose-300">{error}</p>;
  if (!quiz) return <p className="text-slate-400">Loading…</p>;
  return (
    <div className="space-y-6">
      <h1 className="heading text-3xl">Edit quiz</h1>
      <QuizEditor initial={quiz} />
    </div>
  );
}
