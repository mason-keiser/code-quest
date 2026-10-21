import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { HttpError, check, handle, ok } from "@/lib/http";
import { buildGameState, loadGame, loadQuestions } from "@/lib/game";

/** GET /api/games/:pin — the live game state, tailored to the caller (host vs. player). */
export const GET = handle(async (_req: NextRequest, ctx: RouteContext<"/api/games/[pin]">) => {
  const me = await requireUser();
  const { pin } = await ctx.params;
  const game = await loadGame(pin);
  return ok(await buildGameState(game, me));
});

const actionSchema = z.object({ action: z.enum(["start", "reveal", "next", "end"]) });

/**
 * PATCH /api/games/:pin — host controls that advance the game:
 *   start  lobby → first question
 *   reveal question → show correct answer + answer distribution
 *   next   reveal → next question (or finished after the last one)
 *   end    any → finished (awards points to player accounts)
 */
export const PATCH = handle(async (req: NextRequest, ctx: RouteContext<"/api/games/[pin]">) => {
  const me = await requireUser("instructor", "admin");
  const { pin } = await ctx.params;
  const { action } = actionSchema.parse(await req.json());
  const game = await loadGame(pin);
  if (game.host_id !== me.id && me.role !== "admin") throw new HttpError(403, "Only the host can control this game");

  const db = supabaseAdmin();
  const questions = await loadQuestions(game.quiz_set_id);
  const now = new Date().toISOString();

  // Each transition is guarded on the current status so double-clicks and
  // concurrent requests can't skip a question or award points twice.
  const transition = async (from: string[], patch: Record<string, unknown>) => {
    const { data } = await db.from("games").update(patch).eq("id", game.id).in("status", from).eq("current_index", game.current_index).select();
    return (data?.length ?? 0) > 0;
  };

  const finish = async () => {
    if (await transition(["lobby", "question", "reveal"], { status: "finished", ended_at: now })) {
      check(await db.rpc("award_game_points", { p_game_id: game.id }));
    }
  };

  switch (action) {
    case "start":
      if (game.status !== "lobby") throw new HttpError(409, "Game already started");
      if (!questions.length) throw new HttpError(409, "This quiz has no questions");
      await transition(["lobby"], { status: "question", current_index: 0, question_started_at: now });
      break;

    case "reveal": {
      if (game.status !== "question") throw new HttpError(409, "No question is open");
      if (await transition(["question"], { status: "reveal" })) {
        // Anyone who didn't answer loses their streak.
        const current = questions[game.current_index];
        const answered = check(await db.from("answers").select("player_id").eq("game_id", game.id).eq("question_id", current.id));
        let reset = db.from("game_players").update({ streak: 0 }).eq("game_id", game.id);
        if (answered.length) reset = reset.not("id", "in", `(${answered.map((a) => a.player_id).join(",")})`);
        check(await reset);
      }
      break;
    }

    case "next":
      if (game.status !== "reveal") throw new HttpError(409, "Reveal the answer first");
      if (game.current_index + 1 >= questions.length) await finish();
      else await transition(["reveal"], { status: "question", current_index: game.current_index + 1, question_started_at: now });
      break;

    case "end":
      if (game.status === "finished") throw new HttpError(409, "Game already finished");
      await finish();
      break;
  }

  return ok(await buildGameState(await loadGame(pin), me));
});
