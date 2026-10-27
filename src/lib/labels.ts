export function countLabel(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
/** Minutes as shown in lists; sessions under a minute read "<1 min". */
export function durationLabel(minutes: number) {
  return `${minutes === 0 ? "<1" : minutes} min`;
}
