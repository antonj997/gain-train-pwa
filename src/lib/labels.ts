export function countLabel(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
/**
 * Every duration the app shows, from a whole number of minutes: "<1 min",
 * "45 min", "1 h 53 min", "2 h". Nothing reads "0 min".
 */
export function durationLabel(minutes: number) {
  const total = Math.round(minutes);
  if (total < 1) return "<1 min";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
/** The Finish sheet's one-line summary of what saving keeps and leaves out. */
export function finishSummary(completed: number, unchecked: number) {
  if (completed === 0) return "Complete at least one set";
  const saved = `${countLabel(completed, "set")} will be saved`;
  return unchecked > 0
    ? `${saved} · ${countLabel(unchecked, "unchecked set")} left out`
    : saved;
}
