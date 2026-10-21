"use client";

import { useEffect, useState } from "react";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import type { Profile } from "@/lib/types";

/** The signed-in user's profile (null when signed out, undefined while loading). */
export function useProfile() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);

  useEffect(() => {
    const load = () =>
      api<{ profile: Profile }>("/api/me")
        .then((d) => setProfile(d.profile))
        .catch(() => setProfile(null));
    load();
    const { data } = supabaseBrowser().auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") load();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return profile;
}
