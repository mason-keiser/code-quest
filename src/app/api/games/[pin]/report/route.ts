import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { HttpError, check, handle, ok } from "@/lib/http";
import { loadGame, loadQuestions, type PlayerRow } from "@/lib/game";

/**
 * GET /api/games/:pin/report — post-game analytics for the host:
 * per-question accuracy (most-missed first) and per-student performance.
 */
export const GET = handle(async (_req: NextRequest, ctx: RouteContext<"/api/games/[pin]/report">) => {
  const me = await requireUser("instructor", "admin");
  const { pin } = await ctx.params;
  const game = await loadGame(pin);
  if (game.host_id !== me.id && me.role !== "admin") throw new HttpError(403, "Only the host can view this report");

  const db = supabaseAdmin();
  type AnswerRow = { player_id: string; question_id: string; choice_index: number; is_correct: boolean; response_ms: number };
  const [questions, playersRes, answersRes, quizRes] = await Promise.all([
    loadQuestions(game.quiz_set_id),
    db.from("game_players").select("*").eq("game_id", game.id).order("score", { ascending: false }).returns<PlayerRow[]>(),
    db.from("answers").select("player_id, question_id, choice_index, is_correct, response_ms").eq("game_id", game.id).returns<AnswerRow[]>(),
    db.from("quiz_sets").select("title").eq("id", game.quiz_set_id).single<{ title: string }>(),
  ]);
  const players: PlayerRow[] = check(playersRes);
  const answers: AnswerRow[] = check(answersRes);
  const asked = game.status === "finished" ? questions.length : Math.max(game.current_index + 1, 0);

  const questionStats = questions.slice(0, asked).map((q) => {
    const qa = answers.filter((a) => a.question_id === q.id);
    const correct = qa.filter((a) => a.is_correct).length;
    return {
      id: q.id,
      position: q.position,
      prompt: q.prompt,
      type: q.type,
      code_snippet: q.code_snippet,
      code_language: q.code_language,
      choices: q.choices,
      correct_index: q.correct_index,
      answered: qa.length,
      no_answer: players.length - qa.length,
      correct,
      accuracy: players.length ? correct / players.length : 0,
      avg_response_ms: qa.length ? Math.round(qa.reduce((s, a) => s + a.response_ms, 0) / qa.length) : null,
      choice_counts: q.choices.map((_, i) => qa.filter((a) => a.choice_index === i).length),
    };
  });

  const studentStats = players.map((p, rank) => {
    const pa = answers.filter((a) => a.player_id === p.id);
    const correct = pa.filter((a) => a.is_correct).length;
    return {
      id: p.id,
      rank: rank + 1,
      nickname: p.nickname,
      avatar: p.avatar,
      score: p.score,
      answered: pa.length,
      correct,
      accuracy: asked ? correct / asked : 0,
      missed_positions: questionStats
        .filter((q) => !pa.some((a) => a.question_id === q.id && a.is_correct))
        .map((q) => q.position + 1),
    };
  });

  const totalCorrect = questionStats.reduce((s, q) => s + q.correct, 0);
  return ok({
    game: { pin: game.pin, status: game.status, created_at: game.created_at, ended_at: game.ended_at, quiz_title: check(quizRes).title },
    summary: {
      players: players.length,
      questions: asked,
      class_accuracy: players.length && asked ? totalCorrect / (players.length * asked) : 0,
    },
    questions: questionStats,
    most_missed: [...questionStats].sort((a, b) => a.accuracy - b.accuracy).slice(0, 3),
    students: studentStats,
  });
});
