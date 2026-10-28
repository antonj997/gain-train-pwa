import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

type Props = {
  title: ReactNode;
  /** A muted second line. */
  sub?: ReactNode;
  /** The current value, shown at the right before the chevron. */
  value?: ReactNode;
  /** Replaces the chevron, such as a status chip or a play button. */
  trailing?: ReactNode;
  /** Draw a chevron at the right edge, for rows that open something. */
  chevron?: boolean;
  /** The row is a link. */
  to?: string;
  /** The row is a button. Without `to` or `onClick` it is plain content. */
  onClick?: () => void;
  disabled?: boolean;
  tone?: "accent" | "danger";
  leading?: ReactNode;
  className?: string;
};

/** A row for the `.list` group: a button, link or plain row with a chevron. Styles live in styles/pages.css. */
export default function ListRow({
  title,
  sub,
  value,
  trailing,
  chevron,
  to,
  onClick,
  disabled,
  tone,
  leading,
  className,
}: Props) {
  const content = (
    <>
      {leading}
      <span className="row-main">
        <span className="row-title">{title}</span>
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      {value !== undefined && <span className="row-value">{value}</span>}
      {trailing}
      {chevron && (
        <ChevronRight className="chev" size={20} aria-hidden="true" />
      )}
    </>
  );
  const classes =
    "row" + (tone ? ` row-${tone}` : "") + (className ? ` ${className}` : "");
  if (to)
    return (
      <Link className={classes} to={to}>
        {content}
      </Link>
    );
  if (onClick)
    return (
      <button
        type="button"
        className={classes}
        onClick={onClick}
        disabled={disabled}
      >
        {content}
      </button>
    );
  return <div className={classes}>{content}</div>;
}
