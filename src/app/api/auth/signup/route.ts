import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { HttpError, handle, ok } from "@/lib/http";
import { usernameSchema } from "@/lib/validation";
import { usernameToEmail, AVATARS } from "@/lib/constants";
import { isClean } from "@/lib/profanity";

const signupSchema = z.object({
  username: usernameSchema,
  password: z.string().min(6, "Passwords need at least 6 characters").max(72),
  display_name: z.string().trim().min(1).max(30),
  role: z.enum(["student", "instructor"]).default("student"),
  invite_code: z.string().optional(),
  avatar: z.string().refine((a) => AVATARS.includes(a)).optional(),
});

/**
 * POST /api/auth/signup — create a username/password account.
 * Instructor accounts require the INSTRUCTOR_INVITE_CODE so students can't promote themselves.
 * Admin accounts can only be granted by another admin.
 */
export const POST = handle(async (req: Request) => {
  const body = signupSchema.parse(await req.json());

  if (!isClean(body.username) || !isClean(body.display_name)) {
    throw new HttpError(400, "Please choose a school-appropriate name");
  }
  if (body.role === "instructor" && body.invite_code !== process.env.INSTRUCTOR_INVITE_CODE) {
    throw new HttpError(403, "Invalid instructor invite code");
  }

  const db = supabaseAdmin();
  const { data: existing } = await db.from("profiles").select("id").eq("username", body.username).maybeSingle();
  if (existing) throw new HttpError(409, "That username is taken");

  const { data, error } = await db.auth.admin.createUser({
    email: usernameToEmail(body.username),
    password: body.password,
    email_confirm: true,
    user_metadata: { username: body.username },
  });
  if (error || !data.user) throw new HttpError(400, error?.message ?? "Could not create account");

  const { error: profileError } = await db.from("profiles").insert({
    id: data.user.id,
    username: body.username,
    display_name: body.display_name,
    role: body.role,
    avatar: body.avatar ?? AVATARS[Math.floor(Math.random() * AVATARS.length)],
  });
  if (profileError) {
    await db.auth.admin.deleteUser(data.user.id);
    throw new HttpError(500, profileError.message);
  }

  return ok({ username: body.username }, 201);
});
