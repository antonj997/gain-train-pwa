import { CATEGORY_CHIPS, type CategoryChip } from "@/lib/category-filter";
import { categoryLabel } from "@/lib/catalogue-labels";
import { useT } from "@/i18n/useT";

/**
 * The category chips (v6 §B11, E1): one sideways-scrolling row of 44px
 * filter chips, Alla first and Mina last, the chosen one in the selected
 * look. Styles: `.facet-chips` (pages.css) and `.filter-chip`
 * (components.css).
 */
export default function CategoryChips({
  value,
  onChange,
  chips = CATEGORY_CHIPS,
  label,
}: {
  value: CategoryChip;
  onChange: (chip: CategoryChip) => void;
  /** The chips to offer, in order; every one by default. */
  chips?: readonly CategoryChip[];
  /** Names the row for assistive technology; "Category" by default. */
  label?: string;
}) {
  const { t } = useT();
  const text = (chip: CategoryChip) =>
    chip === "all"
      ? t("exercises.filterAll")
      : chip === "mine"
        ? t("exercises.filterMine")
        : categoryLabel(chip);
  return (
    <div
      className="facet-chips category-chips"
      role="group"
      aria-label={label ?? t("facet.category")}
    >
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          className="filter-chip"
          aria-pressed={value === chip}
          onClick={() => onChange(chip)}
        >
          {text(chip)}
        </button>
      ))}
    </div>
  );
}
