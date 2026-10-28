/**
 * Train's title: dry, a little sarcastic, or a random fact. One line per day.
 * Short enough for two lines at 28px; no slogans, no exclamation marks.
 */
export const HEADLINES = [
  // Dry and sarcastic
  "The couch will survive without you",
  "Your muscles have filed a complaint",
  "Lift now, complain later",
  "Cardio is a rumour",
  "Today's excuse has been noted",
  "Rest days are not a personality",
  "The barbell misses you. Probably",
  "Sore tomorrow, smug today",
  "Leg day called. Again.",
  "Gravity: still undefeated",
  "Heavy things won't lift themselves",
  "The mirror can wait",
  "Warm-ups count. Sadly",
  "Nobody needs that many rest days",
  "Your phone is a very good rest timer",
  // Random facts
  "Octopuses have three hearts",
  "Honey never really spoils",
  "A day on Venus outlasts its year",
  "Bananas are berries; strawberries not",
  "Sharks are older than trees",
  "Wombat droppings are cube-shaped",
  "Sloths hold their breath for 40 min",
  "Oxford is older than the Aztec empire",
  "The Eiffel Tower grows in summer",
  "A group of flamingos is a flamboyance",
  "Scotland's national animal is a unicorn",
  "Muscles can't push, they only pull",
  "Your heart beats ~100,000 times a day",
];

/** Days since 1970-01-01 in local time, so the line changes at local midnight. */
function localDay(date: Date) {
  return Math.floor(
    (date.getTime() - date.getTimezoneOffset() * 60_000) / 86_400_000,
  );
}

/**
 * The line for `date`. Stepping through the list by a stride that shares no
 * factor with its length visits every line before repeating, and two
 * consecutive days never get the same one.
 */
export function headlineFor(
  date: Date = new Date(),
  lines: readonly string[] = HEADLINES,
) {
  const n = lines.length;
  if (n === 0) return "";
  let stride = 7;
  while (gcd(stride, n) !== 1) stride++;
  return lines[(((localDay(date) * stride) % n) + n) % n];
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
