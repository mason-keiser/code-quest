import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { HttpError, check, checkMaybe, handle, ok } from "@/lib/http";
import { quizSetSchema } from "@/lib/validation";
import type { Profile, QuizSet } from "@/lib/types";

async function loadOwned(id: string, me: Profile, { allowPublic = false } = {}) {
  const quiz = checkMaybe(await supabaseAdmin().from("quiz_sets").select("*").eq("id", id).maybeSingle<QuizSet>());
  if (!quiz) throw new HttpError(404, "Quiz not found");
  const canAccess = quiz.owner_id === me.id || me.role === "admin" || (allowPublic && quiz.is_public);
  if (!canAccess) throw new HttpError(403, "You can only change your own quizzes");
  return quiz;
}

/** GET /api/quizzes/:id — a quiz set with all of its questions (owner, admin, or public). */
export const GET = handle(async (_req: NextRequest, ctx: RouteContext<"/api/quizzes/[id]">) => {
  const me = await requireUser("instructor", "admin");
  const { id } = await ctx.params;
  const quiz = await loadOwned(id, me, { allowPublic: true });
  const questions = check(
    await supabaseAdmin().from("questions").select("*").eq("quiz_set_id", id).order("position"),
  );
  return ok({ quiz: { ...quiz, questions } });
});

/** PUT /api/quizzes/:id — replace a quiz set's details and questions. */
export const PUT = handle(async (req: NextRequest, ctx: RouteContext<"/api/quizzes/[id]">) => {
  const me = await requireUser("instructor", "admin");
  const { id } = await ctx.params;
  await loadOwned(id, me);
  const { questions, ...set } = quizSetSchema.parse(await req.json());
  const db = supabaseAdmin();

  const quiz = check(
    await db.from("quiz_sets").update({ ...set, updated_at: new Date().toISOString() }).eq("id", id).select().single(),
  );

  // Sync questions in place (rather than delete-and-reinsert) so answers from
  // past games stay linked to the same question ids and reports remain accurate.
  const existing = check(await db.from("questions").select("id").eq("quiz_set_id", id)).map((q) => q.id as string);
  const keptIds = questions.map((q) => q.id).filter((qid): qid is string => !!qid && existing.includes(qid));
  const removed = existing.filter((qid) => !keptIds.includes(qid));
  if (removed.length) check(await db.from("questions").delete().in("id", removed));

  const rows = questions.map(({ id: qid, ...q }, position) => ({
    ...q,
    ...(qid && existing.includes(qid) ? { id: qid } : {}),
    image_url: q.image_url || null,
    position,
    quiz_set_id: id,
  }));
  const updates = rows.filter((r) => "id" in r);
  const inserts = rows.filter((r) => !("id" in r));
  if (updates.length) check(await db.from("questions").upsert(updates));
  if (inserts.length) check(await db.from("questions").insert(inserts));
  return ok({ quiz });
});

/** DELETE /api/quizzes/:id — delete a quiz set (cascades to its questions and games). */
export const DELETE = handle(async (_req: NextRequest, ctx: RouteContext<"/api/quizzes/[id]">) => {
  const me = await requireUser("instructor", "admin");
  const { id } = await ctx.params;
  await loadOwned(id, me);
  check(await supabaseAdmin().from("quiz_sets").delete().eq("id", id));
  return ok({ deleted: id });
});
