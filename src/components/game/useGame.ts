"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import type { GameState } from "@/lib/types";

/**
 * Live game state. Supabase Realtime tells us *when* something changed; the
 * REST API tells us *what* the caller is allowed to see (so answers stay
 * hidden until the host reveals them). A slow poll covers dropped sockets.
 */
export function useGame(pin: string) {
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clockOffset = useRef(0); // serverNow - clientNow, for timer sync
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await api<GameState>(`/api/games/${pin}`);
      clockOffset.current = new Date(s.server_now).getTime() - Date.now();
      setState(s);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [pin]);

  // Coalesce bursts of realtime events (e.g. 30 students answering at once).
  const scheduleRefresh = useCallback(() => {
    if (pending.current) return;
    pending.current = setTimeout(() => {
      pending.current = null;
      refresh();
    }, 250);
  }, [refresh]);

  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
  }, [refresh]);

  const gameId = state?.id;
  useEffect(() => {
    if (!gameId) return;
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(`game-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "answers", filter: `game_id=eq.${gameId}` }, scheduleRefresh)
      .subscribe();
    const poll = setInterval(refresh, 4000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [gameId, refresh, scheduleRefresh]);

  const serverNow = useCallback(() => Date.now() + clockOffset.current, []);

  return { state, error, refresh, serverNow };
}

/**
 * Seconds remaining on the current question. Derived from a ticking clock
 * rather than stored, so it is correct on the very first render of a new question.
 */
export function useCountdown(startedAt: string | null | undefined, seconds: number, serverNow: () => number) {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 200);
    return () => clearInterval(id);
  }, [serverNow]);
  if (!startedAt) return seconds;
  const end = new Date(startedAt).getTime() + seconds * 1000;
  return Math.min(seconds, Math.max(0, (end - Math.max(now, new Date(startedAt).getTime())) / 1000));
}
