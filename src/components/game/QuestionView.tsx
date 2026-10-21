"use client";

import { CodeBlock } from "@/components/CodeBlock";
import { CHOICE_STYLES } from "@/lib/constants";
import type { PublicQuestion } from "@/lib/types";

/** The question prompt, optional code/image, and the four coloured answer tiles. */
export function QuestionView({
  question,
  onChoose,
  selected,
  hidden = [],
  disabled,
  large,
}: {
  question: PublicQuestion;
  onChoose?: (index: number) => void;
  selected?: number | null;
  hidden?: number[];
  disabled?: boolean;
  large?: boolean;
}) {
  const revealed = question.correct_index !== undefined;
  const total = question.choice_counts?.reduce((a, b) => a + b, 0) ?? 0;

  return (
    <div className="space-y-5">
      <h2 className={`heading text-center ${large ? "text-4xl" : "text-2xl"}`}>{question.prompt}</h2>
      {question.code_snippet && (
        <CodeBlock code={question.code_snippet} language={question.code_language} className={`mx-auto max-w-2xl ${large ? "text-lg" : ""}`} />
      )}
      {question.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={question.image_url} alt="" className="mx-auto max-h-64 rounded-xl" />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {question.choices.map((choice, i) => {
          const style = CHOICE_STYLES[i];
          const isHidden = hidden.includes(i);
          const isCorrect = revealed && i === question.correct_index;
          const dim = (revealed && !isCorrect) || isHidden || (selected != null && selected !== i);
          return (
            <button
              key={i}
              onClick={() => onChoose?.(i)}
              disabled={disabled || isHidden || !onChoose}
              className={`relative flex min-h-20 items-center gap-4 overflow-hidden rounded-2xl px-5 py-4 text-left font-semibold text-white shadow-lg transition
                ${style.bg} ${dim ? "opacity-35" : ""} ${isCorrect ? "ring-4 ring-white" : ""}
                ${onChoose && !disabled ? "hover:brightness-110 active:scale-[0.98]" : "cursor-default"}
                ${large ? "text-2xl" : "text-lg"}`}
            >
              {revealed && total > 0 && (
                <span
                  className="absolute inset-y-0 left-0 bg-black/20 transition-all duration-700"
                  style={{ width: `${((question.choice_counts?.[i] ?? 0) / total) * 100}%` }}
                />
              )}
              <span className="relative text-2xl">{style.shape}</span>
              <span className={`relative flex-1 ${question.type === "code_output" ? "font-mono" : ""}`}>
                {isHidden ? "—" : choice}
              </span>
              {revealed && <span className="relative text-base">{question.choice_counts?.[i] ?? 0}</span>}
              {isCorrect && <span className="relative text-2xl">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
