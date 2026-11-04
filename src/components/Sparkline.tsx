import { sparklinePoints } from "@/data/analytics";

/** A 64×28 trend line with no axes; the text beside it carries the numbers. */
export default function Sparkline({ values }: { values: number[] }) {
  return (
    <svg
      className="sparkline"
      width="64"
      height="28"
      viewBox="0 0 64 28"
      aria-hidden="true"
      focusable="false"
    >
      <polyline
        points={sparklinePoints(values)}
        fill="none"
        stroke="var(--gt-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
