import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { t } from "@/i18n";

/**
 * Filter chip rows that fold away while a search is on, so the results get
 * the room above the keyboard. Folded, they still filter, and are hidden from
 * focus and assistive technology.
 */
export function CollapsibleFilters({
  id,
  collapsed,
  children,
}: {
  id: string;
  collapsed: boolean;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      className="search-filters"
      data-collapsed={collapsed || undefined}
      aria-hidden={collapsed || undefined}
    >
      <div className="search-filters-inner">{children}</div>
    </div>
  );
}

/** "Filter", with a badge counting the active filters: brings the folded rows back. */
export function FilterToggle({
  count,
  controls,
  onClick,
}: {
  count: number;
  /** The id of the folded rows. */
  controls: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="filter-chip filter-toggle"
      aria-expanded={false}
      aria-controls={controls}
      aria-label={
        count
          ? t("search.showFiltersCount", { count })
          : t("search.showFilters")
      }
      onClick={onClick}
    >
      <SlidersHorizontal size={16} aria-hidden="true" />
      {t("search.filter")}
      {count > 0 && (
        <span className="filter-count" aria-hidden="true">
          {count}
        </span>
      )}
    </button>
  );
}
