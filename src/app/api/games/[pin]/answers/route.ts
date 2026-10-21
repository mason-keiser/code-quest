import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { HttpError, check, handle, ok } from "@/lib/http";
import { fiftyFiftyHidden, loadGame, loadPlayer, loadQuestions } from "@/lib/game";
import { scoreAnswer } from "@/lib/scoring";
import { EXTRA_TIME_SECONDS } from "@/lib/constants";

const answerSchema = z.object({ choice_index: z.number().int().min(0) });

// Allowance for network latency between the timer hitting zero and the request arriving.
const GRACE_MS = 1500;

/**
 * POST /api/games/:pin/answers — submit an answer to the current question.
 * Scoring happens here on the server (never trusted from the client).
 */
export const POST = handle(async (req: NextRequest, ctx: RouteContext<"/api/games/[pin]/answers">) => {
  const me = await requireUser();
  const { pin } = await ctx.params;
  const { choice_index } = answerSchema.parse(await req.json());
  const game = await loadGame(pin);
  if (game.status !== "question" || !game.question_started_at) throw new HttpError(409, "No question is open");

  const player = await loadPlayer(game.id, me.id);
  if (!player) throw new HttpError(403, "Join the game first");

  const question = (await loadQuestions(game.quiz_set_id))[game.current_index];
  if (choice_index >= question.choices.length) throw new HttpError(400, "Invalid choice");

  const powerup = player.active_powerup_q === game.current_index ? player.active_powerup : null;
  if (powerup === "fifty" && fiftyFiftyHidden(question, player.id).includes(choice_index)) {
    throw new HttpError(400, "That choice was removed");
  }

  const timeLimitMs = (question.time_limit + (powerup === "time" ? EXTRA_TIME_SECONDS : 0)) * 1000;
  const responseMs = Date.now() - new Date(game.question_started_at).getTime();
  if (responseMs > timeLimitMs + GRACE_MS) throw new HttpError(409, "Time's up!");

  const correct = choice_index === question.correct_index;
  const points = scoreAnswer({
    correct,
    basePoints: question.points,
    responseMs,
    timeLimitMs,
    streak: player.streak,
    doubled: powerup === "double",
  });

  const db = supabaseAdmin();
  const { error } = await db.from("answers").insert({
    game_id: game.id,
    player_id: player.id,
    question_id: question.id,
    choice_index,
    is_correct: correct,
    points_awarded: points,
    response_ms: Math.min(responseMs, timeLimitMs),
  });
  if (error?.code === "23505") throw new HttpError(409, "You already answered");
  if (error) throw new HttpError(500, error.message);

  check(
    await db
      .from("game_players")
      .update({ score: player.score + points, streak: correct ? player.streak + 1 : 0 })
      .eq("id", player.id),
  );

  // The result is withheld until the host reveals, so nobody can tip off classmates.
  return ok({ received: true }, 201);
});
