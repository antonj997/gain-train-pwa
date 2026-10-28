import { session } from "./storage";

/** Train's title. Short enough for two lines at 28px; no slogans, no exclamation marks. */
export const HEADLINES = [
  // Plain
  "Ready to train?",
  "Ready when you are",
  "Time for a session?",
  "What are we lifting?",
  "Today's session",
  // Dry
  "The weights won't lift themselves",
  "Legs again? Legs again.",
  "The bar is just sitting there",
  "Rest days are earned",
  "Chalk is optional, effort isn't",
  "Warm-up counts as a set",
  "Another day, another rep",
  "Skipping leg day is a choice",
  // Encouraging
  "One more good session",
  "Show up, then see",
  "A small session still counts",
  "Just the first set",
  "Good to see you back",
  "Steady beats heroic",
  "Future you will approve",
  // Random
  "Somewhere a pigeon is doing push-ups",
  "A kettlebell is an iron teapot",
  "Squirrels do pull-ups on feeders",
  "The treadmill remembers nothing",
  "Gravity is not on holiday",
  "The dumbbell rack has opinions",
];

const KEY = "gt-headline";

/** A random line that differs from `previous` whenever there is more than one. */
export function pickHeadline(
  previous: string | null,
  random: () => number = Math.random,
  lines: readonly string[] = HEADLINES,
) {
  const choices = lines.filter((line) => line !== previous);
  const pool = choices.length ? choices : lines;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

/** Picks a headline and remembers it for this browser session, so the next pick differs. */
export function nextHeadline(random?: () => number) {
  const line = pickHeadline(session.getItem(KEY), random);
  try {
    session.setItem(KEY, line);
  } catch {
    /* Without session storage a repeat is possible but harmless. */
  }
  return line;
}
