import type { ReactNode } from "react";
import { Trophy } from "lucide-react";

/** The record item: a warm pill with a trophy, such as “140 kg · heaviest”. */
export default function RecordPill({
  children,
  small,
  quiet,
}: {
  children: ReactNode;
  /** A compact pill for inside a row's muted line. */
  small?: boolean;
  /** Estimated records only (e1RM): a muted pill instead of the warm one. */
  quiet?: boolean;
}) {
  return (
    <span
      className={
        "record-pill" + (small ? " is-small" : "") + (quiet ? " is-quiet" : "")
      }
    >
      <Trophy size={small ? 13 : 16} aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}
