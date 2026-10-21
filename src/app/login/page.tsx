"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { usernameToEmail } from "@/lib/constants";

const DEMO = [
  { label: "Student", username: "demo_student" },
  { label: "Instructor", username: "demo_teacher" },
  { label: "Admin", username: "demo_admin" },
];

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/dashboard";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async (u: string, p: string) => {
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: usernameToEmail(u), password: p });
    setBusy(false);
    if (error) return setError("Wrong username or password");
    router.push(next.startsWith("/") ? next : "/dashboard");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          signIn(username, password);
        }}
        className="card space-y-4"
      >
        <h1 className="heading text-3xl">Welcome back</h1>
        <div>
          <label className="label" htmlFor="username">Username</label>
          <input id="username" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" className="input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Log in"}</button>
        <p className="text-center text-sm text-slate-400">
          New here? <Link href="/signup" className="text-indigo-300 hover:underline">Create an account</Link>
        </p>
      </form>

      {process.env.NEXT_PUBLIC_DEMO_PASSWORD && (
        <div className="card space-y-3">
          <p className="text-sm text-slate-300">👋 Reviewing CodeQuest? Try a demo account:</p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO.map((d) => (
              <button key={d.username} className="btn-secondary text-sm" disabled={busy} onClick={() => signIn(d.username, process.env.NEXT_PUBLIC_DEMO_PASSWORD!)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
