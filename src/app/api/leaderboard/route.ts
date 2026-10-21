import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { check, handle, ok } from "@/lib/http";

/** GET /api/leaderboard — top students by lifetime points. */
export const GET = handle(async () => {
  await requireUser();
  const leaders = check(
    await supabaseAdmin()
      .from("profiles")
      .select("id, username, display_name, avatar, total_points")
      .eq("role", "student")
      .order("total_points", { ascending: false })
      .limit(25),
  );
  return ok({ leaders });
});
