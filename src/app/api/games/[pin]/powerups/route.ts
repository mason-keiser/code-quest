import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { HttpError, check, handle, ok } from "@/lib/http";
import { loadGame, loadPlayer, loadQuestions } from "@/lib/game";

const powerupSchema = z.object({ type: z.enum(["double", "fifty", "time"]) });

/** POST /api/games/:pin/powerups — activate a one-per-game power-up for the current question. */
export const POST = handle(async (req: NextRequest, ctx: RouteContext<"/api/games/[pin]/powerups">) => {
  const me = await requireUser();
  const { pin } = await ctx.params;
  const { type } = powerupSchema.parse(await req.json());
  const game = await loadGame(pin);
  if (game.status !== "question") throw new HttpError(409, "Power-ups can only be used while a question is open");

  const player = await loadPlayer(game.id, me.id);
  if (!player) throw new HttpError(403, "Join the game first");
  if (player.powerups_used.includes(type)) throw new HttpError(409, "You've already used that power-up");
  if (player.active_powerup_q === game.current_index) throw new HttpError(409, "One power-up per question");

  const question = (await loadQuestions(game.quiz_set_id))[game.current_index];
  if (type === "fifty" && question.choices.length < 3) throw new HttpError(409, "50/50 needs at least 3 choices");

  const db = supabaseAdmin();
  const { count } = await db
    .from("answers")
    .select("id", { count: "exact", head: true })
    .eq("player_id", player.id)
    .eq("question_id", question.id);
  if (count) throw new HttpError(409, "You already answered this question");

  check(
    await db
      .from("game_players")
      .update({ powerups_used: [...player.powerups_used, type], active_powerup: type, active_powerup_q: game.current_index })
      .eq("id", player.id),
  );
  return ok({ activated: type }, 201);
});
