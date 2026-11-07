import type { PhaseSegment } from "@/data/phase";

/**
 * The plan / phase item: one segment per week of the phase. Weeks done are
 * the done colour, this week the accent, deload weeks grey and the rest
 * surface-2. Decorative: the text beside it says the week.
 */
export default function PhaseBar({
  segments,
  tall,
}: {
  segments: readonly PhaseSegment[];
  /** 14px instead of 10px, for the plan page. */
  tall?: boolean;
}) {
  return (
    <span className={"phase-bar" + (tall ? " is-tall" : "")} aria-hidden="true">
      {segments.map((s) => (
        <span
          key={s.week}
          className={`phase-seg is-${s.state}${s.deload ? " is-deload" : ""}`}
        />
      ))}
    </span>
  );
}
