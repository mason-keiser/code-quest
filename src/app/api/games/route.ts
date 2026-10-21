import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { HttpError, check, checkMaybe, handle, ok } from "@/lib/http";
import { generatePin } from "@/lib/game";

/** GET /api/games — games the caller has hosted (admins see all), newest first. */
export const GET = handle(async () => {
  const me = await requireUser("instructor", "admin");
  let query = supabaseAdmin()
    .from("games")
    .select("id, pin, status, created_at, ended_at, quiz_sets(title), game_players(count)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (me.role !== "admin") query = query.eq("host_id", me.id);
  const games = check(await query);
  return ok({ games });
});

const createSchema = z.object({ quiz_set_id: z.uuid() });

/** POST /api/games — host a new live game for a quiz set. Returns the join PIN. */
export const POST = handle(async (req: Request) => {
  const me = await requireUser("instructor", "admin");
  const { quiz_set_id } = createSchema.parse(await req.json());
  const db = supabaseAdmin();

  const quiz = checkMaybe(await db.from("quiz_sets").select("id, owner_id, is_public").eq("id", quiz_set_id).maybeSingle<{ id: string; owner_id: string; is_public: boolean }>());
  if (!quiz) throw new HttpError(404, "Quiz not found");
  if (quiz.owner_id !== me.id && !quiz.is_public && me.role !== "admin") throw new HttpError(403, "You can't host this quiz");

  // Retry on the rare PIN collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await db
      .from("games")
      .insert({ pin: generatePin(), quiz_set_id, host_id: me.id })
      .select()
      .single();
    if (!error) return ok({ game: data }, 201);
    if (error.code !== "23505") throw new HttpError(500, error.message);
  }
  throw new HttpError(503, "Couldn't allocate a game PIN, please retry");
});
