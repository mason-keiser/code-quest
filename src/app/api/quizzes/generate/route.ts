import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { HttpError, handle, ok } from "@/lib/http";
import { questionSchema } from "@/lib/validation";

export const maxDuration = 120;

const requestSchema = z.object({
  topic: z.string().trim().min(2).max(200),
  grade_level: z.string().trim().max(30).default("middle school"),
  count: z.number().int().min(1).max(15).default(8),
  include_code: z.boolean().default(true),
  language: z.string().trim().max(30).default("Python"),
});

// Kept free of length/range constraints so it maps cleanly onto structured
// outputs; results are validated against questionSchema afterwards.
const generatedSchema = z.object({
  title: z.string(),
  description: z.string(),
  questions: z.array(
    z.object({
      type: z.enum(["multiple_choice", "true_false", "code_output"]),
      prompt: z.string(),
      code_snippet: z.string().nullable(),
      code_language: z.string().nullable(),
      choices: z.array(z.string()),
      correct_index: z.number().int(),
      time_limit: z.number().int(),
    }),
  ),
});

const SYSTEM = `You write quiz questions for a live classroom quiz game used by K-12 coding instructors.

Guidelines:
- Match vocabulary and difficulty to the stated grade level. Keep prompts short enough to read aloud in a few seconds.
- multiple_choice: exactly 4 choices, one correct, distractors that reflect common student misconceptions.
- true_false: choices must be exactly ["True", "False"].
- code_output: include a short code_snippet (at most 10 lines) and ask what it prints; 4 choices. Set code_language. Trace the code carefully so the correct choice is actually correct.
- For questions without code, code_snippet and code_language are null.
- time_limit: 10–20 seconds for recall, 20–45 for code tracing.
- Vary which index holds the correct answer.
- All content must be school-appropriate.`;

/** POST /api/quizzes/generate — draft a question set with Claude. Not saved; the instructor reviews and edits first. */
export const POST = handle(async (req: Request) => {
  await requireUser("instructor", "admin");
  if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(503, "AI generation isn't configured (missing ANTHROPIC_API_KEY)");
  const body = requestSchema.parse(await req.json());

  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(generatedSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Write ${body.count} questions about "${body.topic}" for ${body.grade_level} students.${
          body.include_code
            ? ` Include a mix of question types, with at least a third being code_output questions in ${body.language}.`
            : " Use multiple_choice and true_false questions only."
        }`,
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new HttpError(422, "That topic couldn't be turned into a quiz. Try rephrasing it.");
  const draft = response.parsed_output;
  if (!draft) throw new HttpError(502, "The AI response couldn't be read. Please try again.");

  // Drop anything that fails our own validation rather than failing the whole draft.
  const questions = draft.questions
    .map((q) => questionSchema.safeParse({ ...q, time_limit: Math.min(Math.max(q.time_limit, 5), 120), points: 1000 }))
    .filter((r) => r.success)
    .map((r) => r.data);
  if (!questions.length) throw new HttpError(502, "The AI didn't produce any usable questions. Please try again.");

  return ok({
    quiz: { title: draft.title, description: draft.description, topic: body.topic, grade_level: body.grade_level, questions },
  });
});
