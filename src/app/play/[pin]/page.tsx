"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { AVATARS, EXTRA_TIME_SECONDS, POWERUPS } from "@/lib/constants";
import { useProfile } from "@/components/useProfile";
import { useCountdown, useGame } from "@/components/game/useGame";
import { QuestionView } from "@/components/game/QuestionView";
import { Scoreboard } from "@/components/game/Scoreboard";
import { TimerRing } from "@/components/game/TimerRing";
import type { PowerUp } from "@/lib/types";

export default function PlayPage() {
  const { pin } = useParams<{ pin: string }>();
  const profile = useProfile();
  const { state, error, refresh, serverNow } = useGame(pin);
  const [msg, setMsg] = useState<string | null>(null);
  // Optimistic choice while the answer request is in flight, keyed by question.
  const [pending, setPending] = useState<{ questionId: string; choice: number } | null>(null);

  const q = state?.question;
  const me = state?.me;
  const extra = me?.active_powerup === "time" ? EXTRA_TIME_SECONDS : 0;
  const left = useCountdown(q?.started_at, (q?.time_limit ?? 0) + extra, serverNow);

  if (error && !state) return <Screen><p>{error}</p><Link href="/dashboard" className="btn-secondary">Back</Link></Screen>;
  if (!state || profile === undefined) return <Screen>Loading…</Screen>;
  if (state.is_host) return <Screen><p>You&apos;re the host of this game.</p><Link href={`/host/${pin}`} className="btn-primary">Open host screen</Link></Screen>;

  if (!me) {
    if (state.status === "finished") return <Screen>This game has ended.</Screen>;
    return <JoinForm pin={pin} defaultName={profile?.display_name ?? ""} defaultAvatar={profile?.avatar ?? AVATARS[0]} onJoined={refresh} />;
  }

  const answer = async (choice: number) => {
    setPending({ questionId: q!.id, choice });
    setMsg(null);
    try {
      await api(`/api/games/${pin}/answers`, { body: { choice_index: choice } });
      await refresh();
    } catch (e) {
      setPending(null);
      setMsg((e as Error).message);
    }
  };

  const activatePowerup = async (type: PowerUp) => {
    setMsg(null);
    try {
      await api(`/api/games/${pin}/powerups`, { body: { type } });
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const rank = [...state.players].sort((a, b) => b.score - a.score).findIndex((p) => p.id === me.id) + 1;
  const chosen = me.answer?.choice_index ?? (pending?.questionId === q?.id ? pending?.choice : null);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center gap-3">
        <span className="text-3xl">{me.avatar}</span>
        <span className="font-semibold">{me.nickname}</span>
        {me.streak >= 2 && <span className="badge bg-orange-500/30 text-orange-200">🔥 {me.streak} streak</span>}
        <span className="ml-auto font-mono text-xl tabular-nums">{me.score.toLocaleString()} pts</span>
      </header>
      {msg && <p className="rounded-xl bg-rose-500/20 px-4 py-2 text-rose-200">{msg}</p>}

      {state.status === "lobby" && (
        <Screen inline>
          <span className="animate-pop text-7xl">{me.avatar}</span>
          <h1 className="heading text-3xl">You&apos;re in!</h1>
          <p className="text-slate-300">See your name on the big screen? The game starts soon.</p>
          <p className="text-sm text-slate-400">{state.players.length} players joined</p>
        </Screen>
      )}

      {state.status === "question" && q && (
        <>
          <div className="flex items-center justify-between">
            <span className="badge">Question {q.index + 1} / {q.total}</span>
            <TimerRing left={left} total={q.time_limit + extra} />
          </div>
          {chosen != null ? (
            <Screen inline>
              <span className="text-6xl">⏳</span>
              <h2 className="heading text-2xl">Answer locked in!</h2>
              <p className="text-slate-300">Waiting for everyone else…</p>
            </Screen>
          ) : left <= 0 ? (
            <Screen inline><span className="text-6xl">⌛</span><h2 className="heading text-2xl">Time&apos;s up!</h2></Screen>
          ) : (
            <>
              <QuestionView question={q} onChoose={answer} hidden={me.hidden_choices} />
              <PowerUpBar used={me.powerups_used} active={me.active_powerup} choices={q.choices.length} onUse={activatePowerup} />
            </>
          )}
        </>
      )}

      {state.status === "reveal" && q && (
        <Screen inline>
          {me.answer?.is_correct ? (
            <>
              <span className="animate-pop text-7xl">🎉</span>
              <h2 className="heading text-4xl text-emerald-300">Correct!</h2>
              <p className="font-mono text-2xl">+{me.answer.points_awarded?.toLocaleString()}</p>
            </>
          ) : (
            <>
              <span className="animate-pop text-7xl">{me.answer ? "😬" : "💤"}</span>
              <h2 className="heading text-4xl text-rose-300">{me.answer ? "Not quite" : "No answer"}</h2>
              <p className="text-slate-300">
                Correct answer: <span className="font-semibold text-white">{q.choices[q.correct_index ?? 0]}</span>
              </p>
            </>
          )}
          <p className="text-lg text-slate-300">You&apos;re in <span className="font-bold text-white">#{rank}</span> place</p>
        </Screen>
      )}

      {state.status === "finished" && (
        <Screen inline>
          <span className="animate-pop text-7xl">{rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : "🏁"}</span>
          <h2 className="heading text-4xl">You finished #{rank}</h2>
          <p className="text-slate-300">
            <span className="font-mono text-white">{me.score.toLocaleString()}</span> points added to your account
          </p>
          <div className="w-full"><Scoreboard players={state.players} highlightId={me.id} limit={5} /></div>
          <Link href="/dashboard" className="btn-primary">Back to dashboard</Link>
        </Screen>
      )}
    </div>
  );
}

function PowerUpBar({ used, active, choices, onUse }: { used: PowerUp[]; active: PowerUp | null; choices: number; onUse: (p: PowerUp) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(Object.keys(POWERUPS) as PowerUp[]).map((key) => {
        const p = POWERUPS[key];
        const isActive = active === key;
        const unavailable = used.includes(key) || !!active || (key === "fifty" && choices < 3);
        return (
          <button
            key={key}
            title={p.description}
            onClick={() => onUse(key)}
            disabled={unavailable}
            className={`btn flex-col gap-0 py-2 text-sm ${isActive ? "bg-amber-400 text-slate-900" : "bg-white/10 hover:bg-white/20"}`}
          >
            <span className="text-xl">{p.icon}</span>
            {p.label}
            {isActive && <span className="text-xs">Active!</span>}
          </button>
        );
      })}
    </div>
  );
}

function JoinForm({ pin, defaultName, defaultAvatar, onJoined }: { pin: string; defaultName: string; defaultAvatar: string; onJoined: () => void }) {
  const [nickname, setNickname] = useState(defaultName);
  const [avatar, setAvatar] = useState(defaultAvatar);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/games/${pin}/players`, { body: { nickname, avatar } });
      onJoined();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <form onSubmit={join} className="card w-full max-w-md space-y-4">
        <h1 className="heading text-center text-3xl">Join game {pin}</h1>
        <div>
          <label className="label" htmlFor="nick">Nickname</label>
          <input id="nick" className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} required />
        </div>
        <div>
          <span className="label">Avatar</span>
          <div className="grid grid-cols-8 gap-1">
            {AVATARS.map((a) => (
              <button
                type="button"
                key={a}
                onClick={() => setAvatar(a)}
                className={`rounded-lg p-1 text-2xl ${avatar === a ? "bg-indigo-500" : "hover:bg-white/10"}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        {err && <p className="text-sm text-rose-300">{err}</p>}
        <button className="btn-primary w-full py-3 text-lg" disabled={busy}>Let&apos;s go! 🚀</button>
      </form>
    </Screen>
  );
}

function Screen({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 text-center ${inline ? "flex-1 py-10" : "min-h-screen px-4"}`}>
      {children}
    </div>
  );
}
