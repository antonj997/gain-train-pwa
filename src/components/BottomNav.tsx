import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Dumbbell, CalendarDays, TrendingUp, Library } from "lucide-react";
import { useT } from "@/i18n/useT";
import { TAB_PATHS } from "@/lib/page-transition";

// In the order of TAB_PATHS, which sets the slide direction.
const tabs = [
  { title: "nav.train", Icon: Dumbbell },
  { title: "nav.history", Icon: CalendarDays },
  { title: "nav.progress", Icon: TrendingUp },
  { title: "nav.library", Icon: Library },
] as const;

/**
 * The bottom navigation (v6 H4): four equal tabs, each an icon over its name
 * (12/600), on an opaque bar. The current tab's icon sits in an accent-soft
 * pill that slides between the tabs (styles in pages.css).
 */
export default function BottomNav({
  active,
  pillAt,
}: {
  /** The current tab's index, or -1 on a page outside the tabs (Settings). */
  active: number;
  /** Where the pill rests: the current tab, or the last one there was. */
  pillAt: number;
}) {
  const { t } = useT();
  return (
    <nav
      className={"bottom-nav" + (active >= 0 ? " has-active" : "")}
      aria-label={t("nav.main")}
      style={{ "--nav-index": pillAt } as CSSProperties}
    >
      <div className="bottom-nav-track">
        <span className="nav-pill" aria-hidden="true" />
        {tabs.map((tab, index) => {
          const current = index === active;
          return (
            <Link
              key={tab.title}
              to={TAB_PATHS[index]}
              className={"nav-tab" + (current ? " is-active" : "")}
              aria-current={current ? "page" : undefined}
            >
              <tab.Icon size={22} aria-hidden="true" />
              <span className="nav-tab-label">{t(tab.title)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
