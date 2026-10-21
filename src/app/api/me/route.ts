import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { HttpError, check, handle, ok } from "@/lib/http";
import { AVATARS } from "@/lib/constants";
import { isClean } from "@/lib/profanity";

/** GET /api/me — the signed-in user's profile plus their recent game history. */
export const GET = handle(async () => {
  const me = await requireUser();
  const history = check(
    await supabaseAdmin()
      .from("game_players")
      .select("score, joined_at, games!inner(pin, status, quiz_sets(title))")
      .eq("user_id", me.id)
      .order("joined_at", { ascending: false })
      .limit(20),
  );
  return ok({ profile: me, history });
});

const updateSchema = z.object({
  display_name: z.string().trim().min(1).max(30).optional(),
  avatar: z.string().refine((a) => AVATARS.includes(a), "Unknown avatar").optional(),
});

/** PATCH /api/me — update display name or avatar. */
export const PATCH = handle(async (req: Request) => {
  const me = await requireUser();
  const body = updateSchema.parse(await req.json());
  if (body.display_name && !isClean(body.display_name)) throw new HttpError(400, "Please choose a school-appropriate name");
  const profile = check(await supabaseAdmin().from("profiles").update(body).eq("id", me.id).select().single());
  return ok({ profile });
});
