import { z } from "zod";

export const questionSchema = z
  .object({
    id: z.uuid().optional(),
    type: z.enum(["multiple_choice", "true_false", "code_output"]),
    prompt: z.string().trim().min(1).max(500),
    code_snippet: z.string().max(2000).nullish(),
    code_language: z.string().max(30).nullish(),
    choices: z.array(z.string().trim().min(1).max(200)).min(2).max(4),
    correct_index: z.number().int().min(0),
    time_limit: z.number().int().min(5).max(120).default(20),
    points: z.number().int().min(0).max(2000).default(1000),
    image_url: z.union([z.url(), z.literal("")]).nullish(),
  })
  .refine((q) => q.correct_index < q.choices.length, {
    message: "correct answer must be one of the choices",
    path: ["correct_index"],
  });

export const quizSetSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().max(500).default(""),
  topic: z.string().max(100).default(""),
  grade_level: z.string().max(30).default(""),
  is_public: z.boolean().default(false),
  questions: z.array(questionSchema).min(1).max(50),
});

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "Usernames are 3–20 lowercase letters, numbers, or underscores");
