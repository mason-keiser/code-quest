import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { HttpError, check, checkMaybe } from "./http";
import type { GameState, GameStatus, PlayerSummary, PowerUp, Profile, Question } from "./types";

export interface GameRow {
  id: string;
  pin: string;
  quiz_set_id: string;
  host_id: string;
  status: GameStatus;
  current_index: number;
  question_started_at: string | null;
  created_at: string;
  ended_at: string | null;
}

export interface PlayerRow extends PlayerSummary {
  game_id: string;
  powerups_used: PowerUp[];
  active_powerup: PowerUp | null;
  active_powerup_q: number | null;
}

export type QuestionRow = Required<Pick<Question, "id" | "position">> & Question;

export async function loadGame(pin: string) {
  const db = supabaseAdmin();
  const game = checkMaybe(await db.from("games").select("*").eq("pin", pin).maybeSingle<GameRow>());
  if (!game) throw new HttpError(404, "No game with that PIN");
  return game;
}

export async function loadQuestions(quizSetId: string): Promise<QuestionRow[]> {
  const db = supabaseAdmin();
  return check(
    await db.from("questions").select("*").eq("quiz_set_id", quizSetId).order("position").returns<QuestionRow[]>(),
  );
}

export async function loadPlayer(gameId: string, userId: string) {
  const db = supabaseAdmin();
  return checkMaybe(
    await db.from("game_players").select("*").eq("game_id", gameId).eq("user_id", userId).maybeSingle<PlayerRow>(),
  );
}

/** Deterministically picks wrong answers to hide for the 50/50 power-up. */
export function fiftyFiftyHidden(question: QuestionRow, playerId: string) {
  const wrong = question.choices.map((_, i) => i).filter((i) => i !== question.correct_index);
  const hideCount = Math.min(2, question.choices.length - 2);
  let seed = [...(playerId + question.id)].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const hidden: number[] = [];
  while (hidden.length < hideCount) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const pick = wrong.filter((i) => !hidden.includes(i))[seed % (wrong.length - hidden.length)];
    hidden.push(pick);
  }
  return hidden.sort();
}

/** Builds the view of a game for one viewer. Correct answers are only included once revealed. */
export async function buildGameState(game: GameRow, viewer: Profile): Promise<GameState> {
  const db = supabaseAdmin();
  const [quiz, questions, players] = await Promise.all([
    db.from("quiz_sets").select("title").eq("id", game.quiz_set_id).single<{ title: string }>(),
    loadQuestions(game.quiz_set_id),
    db.from("game_players").select("*").eq("game_id", game.id).order("score", { ascending: false }).returns<PlayerRow[]>(),
  ]);
  const playerRows = check(players);
  const isHost = game.host_id === viewer.id || viewer.role === "admin";
  const meRow = playerRows.find((p) => p.user_id === viewer.id) ?? null;

  const current = game.current_index >= 0 ? questions[game.current_index] : undefined;
  const inQuestion = current && (game.status === "question" || game.status === "reveal");

  let answers: { player_id: string; choice_index: number; is_correct: boolean; points_awarded: number }[] = [];
  if (inQuestion) {
    answers = check(
      await db.from("answers").select("player_id, choice_index, is_correct, points_awarded")
        .eq("game_id", game.id).eq("question_id", current.id),
    );
  }
  const revealed = game.status === "reveal";

  const question: GameState["question"] = inQuestion
    ? {
        id: current.id,
        index: game.current_index,
        total: questions.length,
        type: current.type,
        prompt: current.prompt,
        code_snippet: current.code_snippet ?? null,
        code_language: current.code_language ?? null,
        choices: current.choices,
        time_limit: current.time_limit,
        points: current.points,
        image_url: current.image_url || null,
        started_at: game.question_started_at,
        ...(revealed && {
          correct_index: current.correct_index,
          choice_counts: current.choices.map((_, i) => answers.filter((a) => a.choice_index === i).length),
        }),
      }
    : null;

  let me: GameState["me"] = null;
  if (meRow) {
    const myAnswer = answers.find((a) => a.player_id === meRow.id);
    const activeNow = meRow.active_powerup_q === game.current_index ? meRow.active_powerup : null;
    me = {
      id: meRow.id,
      user_id: meRow.user_id,
      nickname: meRow.nickname,
      avatar: meRow.avatar,
      score: meRow.score,
      streak: meRow.streak,
      powerups_used: meRow.powerups_used,
      active_powerup: activeNow,
      hidden_choices: activeNow === "fifty" && current ? fiftyFiftyHidden(current, meRow.id) : [],
      answer: myAnswer
        ? revealed
          ? myAnswer
          : { choice_index: myAnswer.choice_index }
        : null,
    };
  }

  return {
    id: game.id,
    pin: game.pin,
    status: game.status,
    quiz_title: check(quiz).title,
    is_host: isHost,
    server_now: new Date().toISOString(),
    question,
    players: playerRows.map(({ id, user_id, nickname, avatar, score, streak }) => ({ id, user_id, nickname, avatar, score, streak })),
    answered_count: answers.length,
    me,
  };
}

export function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
