export function countLabel(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
/** Minutes as shown in lists; sessions under a minute read "<1 min". */
export function durationLabel(minutes: number) {
  return `${minutes === 0 ? "<1" : minutes} min`;
}
/** The Finish sheet's one-line summary of what saving keeps and leaves out. */
export function finishSummary(completed: number, unchecked: number) {
  if (completed === 0) return "Complete at least one set";
  const saved = `${countLabel(completed, "set")} will be saved`;
  return unchecked > 0
    ? `${saved} · ${countLabel(unchecked, "unchecked set")} left out`
    : saved;
}
/** Total training time: "45 min", "1 h 53 min", "2 h". */
export function timeTrainedLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
