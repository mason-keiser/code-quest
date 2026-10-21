import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { HttpError, check, handle, ok } from "@/lib/http";
import { quizSetSchema } from "@/lib/validation";

/**
 * GET /api/quizzes — quiz sets the caller can use: their own, plus public ones.
 * ?scope=mine limits to the caller's own sets.
 */
export const GET = handle(async (req: Request) => {
  const me = await requireUser("instructor", "admin");
  const mine = new URL(req.url).searchParams.get("scope") === "mine";
  let query = supabaseAdmin()
    .from("quiz_sets")
    .select("*, questions(count), profiles!quiz_sets_owner_id_fkey(display_name)")
    .order("updated_at", { ascending: false });
  if (mine || me.role !== "admin") {
    query = mine ? query.eq("owner_id", me.id) : query.or(`owner_id.eq.${me.id},is_public.eq.true`);
  }
  const rows = check(await query);
  const quizzes = rows.map(({ questions, profiles, ...q }) => ({
    ...q,
    question_count: questions?.[0]?.count ?? 0,
    owner_name: profiles?.display_name ?? "",
  }));
  return ok({ quizzes });
});

/** POST /api/quizzes — create a quiz set with its questions. */
export const POST = handle(async (req: Request) => {
  const me = await requireUser("instructor", "admin");
  const { questions, ...set } = quizSetSchema.parse(await req.json());
  const db = supabaseAdmin();

  const quiz = check(await db.from("quiz_sets").insert({ ...set, owner_id: me.id }).select().single());
  const { error } = await db
    .from("questions")
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .insert(questions.map(({ id: _id, ...q }, position) => ({ ...q, image_url: q.image_url || null, position, quiz_set_id: quiz.id })));
  if (error) {
    await db.from("quiz_sets").delete().eq("id", quiz.id);
    throw new HttpError(400, error.message);
  }
  return ok({ quiz }, 201);
});
