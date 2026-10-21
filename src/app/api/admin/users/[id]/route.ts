import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { HttpError, checkMaybe, handle, ok } from "@/lib/http";

const updateSchema = z.object({
  role: z.enum(["student", "instructor", "admin"]).optional(),
  display_name: z.string().trim().min(1).max(30).optional(),
  reset_points: z.boolean().optional(),
});

/** PATCH /api/admin/users/:id — change a user's role or name, or reset their points. */
export const PATCH = handle(async (req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) => {
  const me = await requireUser("admin");
  const { id } = await ctx.params;
  const { reset_points, ...body } = updateSchema.parse(await req.json());
  if (id === me.id && body.role && body.role !== "admin") throw new HttpError(409, "You can't remove your own admin role");

  const patch = { ...body, ...(reset_points && { total_points: 0 }) };
  const user = checkMaybe(await supabaseAdmin().from("profiles").update(patch).eq("id", id).select().maybeSingle());
  if (!user) throw new HttpError(404, "User not found");
  return ok({ user });
});

/** DELETE /api/admin/users/:id — permanently delete an account and its data. */
export const DELETE = handle(async (_req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) => {
  const me = await requireUser("admin");
  const { id } = await ctx.params;
  if (id === me.id) throw new HttpError(409, "You can't delete your own account");
  const { error } = await supabaseAdmin().auth.admin.deleteUser(id); // cascades to profile
  if (error) throw new HttpError(400, error.message);
  return ok({ deleted: id });
});
