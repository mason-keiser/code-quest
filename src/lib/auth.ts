import "server-only";
import { supabaseServer } from "./supabase/server";
import { supabaseAdmin } from "./supabase/admin";
import { HttpError } from "./http";
import type { Profile, Role } from "./types";

/** Resolves the signed-in user's profile, optionally requiring one of the given roles. */
export async function requireUser(...roles: Role[]): Promise<Profile> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new HttpError(401, "Please sign in");

  const { data: profile } = await supabaseAdmin()
    .from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile) throw new HttpError(401, "Profile not found");
  if (roles.length && !roles.includes(profile.role)) throw new HttpError(403, "You don't have access to this");
  return profile;
}
