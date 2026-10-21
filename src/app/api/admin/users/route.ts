import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { check, handle, ok } from "@/lib/http";

/** GET /api/admin/users — every account, with optional ?q= search on username/display name. */
export const GET = handle(async (req: Request) => {
  await requireUser("admin");
  const q = new URL(req.url).searchParams.get("q")?.trim();
  let query = supabaseAdmin().from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
  if (q) {
    const safe = q.replace(/[%,()]/g, "");
    query = query.or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`);
  }
  const users = check(await query);
  return ok({ users });
});
