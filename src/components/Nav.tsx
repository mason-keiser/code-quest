"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useProfile } from "./useProfile";

export function Nav() {
  const profile = useProfile();
  const router = useRouter();
  const path = usePathname();

  // Game screens are full-focus; keep the chrome out of the way.
  if (path.startsWith("/play/") || path.startsWith("/host/")) return null;

  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    router.push("/");
    router.refresh();
  };

  const link = (href: string, label: string) => (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition hover:bg-white/10 ${
        path.startsWith(href) ? "bg-white/10 text-white" : "text-slate-300"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="border-b border-white/10 bg-slate-950/60 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
        <Link href={profile ? "/dashboard" : "/"} className="heading mr-4 text-2xl">
          <span className="text-indigo-400">{"</>"}</span> CodeQuest
        </Link>
        {profile && (
          <>
            {link("/dashboard", "Dashboard")}
            {profile.role !== "student" && link("/quizzes/new", "New Quiz")}
            {link("/leaderboard", "Leaderboard")}
            {profile.role === "admin" && link("/admin", "Admin")}
          </>
        )}
        <div className="ml-auto flex items-center gap-3">
          {profile === null && (
            <>
              <Link href="/login" className="btn-secondary text-sm">Log in</Link>
              <Link href="/signup" className="btn-primary text-sm">Sign up</Link>
            </>
          )}
          {profile && (
            <>
              <span className="hidden text-sm text-slate-300 sm:inline">
                {profile.avatar} {profile.display_name}
                <span className="badge ml-2 capitalize">{profile.role}</span>
              </span>
              <button onClick={signOut} className="btn-secondary text-sm">Sign out</button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
