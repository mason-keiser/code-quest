/**
 * Kahoot-style scoring: a correct answer earns between 50% and 100% of the
 * question's points depending on speed, plus a streak bonus of 10% per prior
 * consecutive correct answer (capped at +50%). Double Points doubles it all.
 */
export function scoreAnswer(opts: {
  correct: boolean;
  basePoints: number;
  responseMs: number;
  timeLimitMs: number;
  streak: number; // streak *before* this answer
  doubled: boolean;
}) {
  if (!opts.correct) return 0;
  const speed = 1 - Math.min(opts.responseMs / opts.timeLimitMs, 1) / 2;
  const streakBonus = 1 + Math.min(opts.streak, 5) * 0.1;
  const points = Math.round(opts.basePoints * speed * streakBonus);
  return opts.doubled ? points * 2 : points;
}
