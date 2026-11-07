import type { ReactNode } from "react";
import { Trophy } from "lucide-react";

/** The record item: a warm pill with a trophy, such as “140 kg · heaviest”. */
export default function RecordPill({
  children,
  small,
}: {
  children: ReactNode;
  /** A compact pill for inside a row's muted line. */
  small?: boolean;
}) {
  return (
    <span className={"record-pill" + (small ? " is-small" : "")}>
      <Trophy size={small ? 13 : 16} aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}
