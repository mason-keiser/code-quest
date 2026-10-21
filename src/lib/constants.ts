export const AVATARS = ["🦊", "🐼", "🐸", "🐙", "🦄", "🐯", "🐧", "🦖", "🐝", "🐳", "🦉", "🐢", "🤖", "👾", "🚀", "⚡"];

/**
 * Students sign in with a username only (no email collected, which is friendlier
 * for K-12 and avoids gathering minors' personal data). Supabase Auth needs an
 * email-shaped identifier, so usernames map onto a non-routable domain.
 */
export const USERNAME_EMAIL_DOMAIN = "users.codequest.invalid";
export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;

export const POWERUPS = {
  double: { label: "Double Points", icon: "✖️2", description: "Double the points for this question." },
  fifty: { label: "50 / 50", icon: "✂️", description: "Remove two wrong answers." },
  time: { label: "+5 Seconds", icon: "⏱️", description: "Get five extra seconds to answer." },
} as const;

export const EXTRA_TIME_SECONDS = 5;

export const CHOICE_STYLES = [
  { bg: "bg-rose-500", shape: "▲" },
  { bg: "bg-sky-500", shape: "◆" },
  { bg: "bg-amber-500", shape: "●" },
  { bg: "bg-emerald-500", shape: "■" },
];
