import { useRef, type ReactNode } from "react";
import SyncNotices from "@/components/SyncNotices";
import { useToastClearance } from "@/hooks/useToastClearance";

type Props = {
  /** A muted line over the title, such as today's date. */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** A control at the left edge, such as a back button. */
  leading?: ReactNode;
  /** A control at the right edge, such as an icon button. */
  action?: ReactNode;
  /** Show the plain "saved on this phone" status banner too. */
  status?: boolean;
  /** Set to false where the notices would repeat what the page itself shows. */
  notices?: boolean;
  /** "first-line" centres the action on the title's first line instead of its last. */
  align?: "last-line" | "first-line";
};

/** The top bar every page shares: eyebrow, title and an optional action, with the notices below. */
export default function PageHeader({
  eyebrow,
  title,
  leading,
  action,
  status,
  notices = true,
  align = "last-line",
}: Props) {
  const bar = useRef<HTMLDivElement>(null);
  useToastClearance(bar);
  return (
    <header className="page-header">
      <div
        ref={bar}
        className={
          "page-header-bar" +
          (leading ? " has-leading" : "") +
          (align === "first-line" ? " align-first-line" : "")
        }
      >
        {leading}
        <div className="page-header-text">
          {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
        </div>
        {action}
      </div>
      {notices && <SyncNotices status={status} />}
    </header>
  );
}
