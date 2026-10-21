import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { HttpError, check, checkMaybe, handle, ok } from "@/lib/http";
import { loadGame } from "@/lib/game";
import { AVATARS } from "@/lib/constants";
import { isClean } from "@/lib/profanity";

const joinSchema = z.object({
  nickname: z.string().trim().min(1).max(20).optional(),
  avatar: z.string().refine((a) => AVATARS.includes(a), "Unknown avatar").optional(),
});

/** POST /api/games/:pin/players — join a game (or rejoin after a refresh). */
export const POST = handle(async (req: NextRequest, ctx: RouteContext<"/api/games/[pin]/players">) => {
  const me = await requireUser();
  const { pin } = await ctx.params;
  const body = joinSchema.parse(await req.json().catch(() => ({})));
  const game = await loadGame(pin);

  if (game.host_id === me.id) throw new HttpError(409, "You're hosting this game");
  if (game.status === "finished") throw new HttpError(409, "This game has ended");

  const nickname = body.nickname ?? me.display_name;
  if (!isClean(nickname)) throw new HttpError(400, "Please choose a school-appropriate nickname");

  const db = supabaseAdmin();
  const existing = checkMaybe(await db.from("game_players").select("*").eq("game_id", game.id).eq("user_id", me.id).maybeSingle());
  if (existing) return ok({ player: existing });

  const taken = check(await db.from("game_players").select("id").eq("game_id", game.id).ilike("nickname", nickname));
  if (taken.length) throw new HttpError(409, "Someone in this game already has that nickname");

  const player = check(
    await db
      .from("game_players")
      .insert({ game_id: game.id, user_id: me.id, nickname, avatar: body.avatar ?? me.avatar })
      .select()
      .single(),
  );
  return ok({ player }, 201);
});

/** DELETE /api/games/:pin/players?id=… — host removes a player from the lobby. */
export const DELETE = handle(async (req: NextRequest, ctx: RouteContext<"/api/games/[pin]/players">) => {
  const me = await requireUser("instructor", "admin");
  const { pin } = await ctx.params;
  const playerId = new URL(req.url).searchParams.get("id");
  if (!playerId) throw new HttpError(400, "Missing player id");
  const game = await loadGame(pin);
  if (game.host_id !== me.id && me.role !== "admin") throw new HttpError(403, "Only the host can remove players");
  check(await supabaseAdmin().from("game_players").delete().eq("id", playerId).eq("game_id", game.id));
  return ok({ removed: playerId });
});
