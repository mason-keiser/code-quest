import filter from "leo-profanity";

export function isClean(text: string) {
  // Also catch words hidden by separators, e.g. "b_a_d" or "b.a.d".
  const squashed = text.replace(/[^a-z0-9]/gi, "");
  return !filter.check(text) && !filter.check(squashed);
}
