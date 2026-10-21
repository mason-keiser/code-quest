"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AVATARS, usernameToEmail } from "@/lib/constants";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    display_name: "",
    password: "",
    role: "student" as "student" | "instructor",
    invite_code: "",
    avatar: AVATARS[0],
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const username = form.username.trim().toLowerCase();
      await api("/api/auth/signup", { body: { ...form, username } });
      const { error } = await supabaseBrowser().auth.signInWithPassword({ email: usernameToEmail(username), password: form.password });
      if (error) throw error;
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card mx-auto max-w-md space-y-4">
      <h1 className="heading text-3xl">Create your account</h1>

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-900/70 p-1">
        {(["student", "instructor"] as const).map((r) => (
          <button
            type="button"
            key={r}
            onClick={() => setForm({ ...form, role: r })}
            className={`rounded-lg py-2 font-semibold capitalize transition ${form.role === r ? "bg-indigo-500 text-white" : "text-slate-300 hover:bg-white/5"}`}
          >
            {r === "student" ? "🎒 Student" : "🧑‍🏫 Instructor"}
          </button>
        ))}
      </div>

      <div>
        <label className="label" htmlFor="username">Username</label>
        <input id="username" className="input" value={form.username} onChange={set("username")} placeholder="e.g. coder_kid42" autoComplete="username" required />
        <p className="mt-1 text-xs text-slate-400">No email needed. 3–20 letters, numbers, or underscores.</p>
      </div>
      <div>
        <label className="label" htmlFor="display">Display name</label>
        <input id="display" className="input" value={form.display_name} onChange={set("display_name")} placeholder="What should we call you?" maxLength={30} required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" type="password" className="input" value={form.password} onChange={set("password")} minLength={6} autoComplete="new-password" required />
      </div>
      {form.role === "instructor" && (
        <div>
          <label className="label" htmlFor="invite">Instructor invite code</label>
          <input id="invite" className="input" value={form.invite_code} onChange={set("invite_code")} required />
          <p className="mt-1 text-xs text-slate-400">Ask your program admin for this code.</p>
        </div>
      )}
      <div>
        <span className="label">Pick an avatar</span>
        <div className="grid grid-cols-8 gap-1">
          {AVATARS.map((a) => (
            <button type="button" key={a} onClick={() => setForm({ ...form, avatar: a })} className={`rounded-lg p-1 text-2xl ${form.avatar === a ? "bg-indigo-500" : "hover:bg-white/10"}`}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating account…" : "Sign up"}</button>
      <p className="text-center text-sm text-slate-400">
        Already have an account? <Link href="/login" className="text-indigo-300 hover:underline">Log in</Link>
      </p>
    </form>
  );
}
