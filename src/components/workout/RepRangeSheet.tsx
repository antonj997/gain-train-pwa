import type { Exercise } from "@/data/model";
import Sheet from "@/components/ui/Sheet";
import Segmented from "@/components/ui/Segmented";
import { useT } from "@/i18n/useT";
import type { CountChoice } from "@/lib/rep-hold";

type Range = NonNullable<Exercise["repRange"]>;

/** The ranges the sheet offers (v6 B7). */
const REP_RANGES: readonly Range[] = [
  { min: 3, max: 5 },
  { min: 5, max: 7 },
  { min: 6, max: 8 },
  { min: 8, max: 10 },
  { min: 8, max: 12 },
  { min: 10, max: 15 },
];

const key = (range: Range) => `${range.min}-${range.max}`;
const label = (range: Range) =>
  range.min === range.max ? String(range.min) : `${range.min}–${range.max}`;

/**
 * An exercise's rep range for double progression (v6 B7): one segment of
 * six ranges. Reps go up to the top in every set, then the weight steps up.
 * In a workout the sheet also chooses what the count measures (reps, reps +
 * hold, or a hold in seconds), which "Reps ⌄" opened before.
 */
export default function RepRangeSheet({
  open,
  name,
  value,
  onClose,
  onChange,
  count,
}: {
  open: boolean;
  name: string;
  value: Range | undefined;
  onClose: () => void;
  /** The new range, or null to remove it. */
  onChange: (range: Range | null) => void;
  /** A workout's count: what it measures, and the choices it has. */
  count?: {
    value: CountChoice;
    options: { value: CountChoice; label: string }[];
    onChange: (choice: CountChoice) => void;
  };
}) {
  const { t } = useT();
  // A range typed before v6 that is not one of the six stays offered.
  const options =
    value && !REP_RANGES.some((r) => key(r) === key(value))
      ? [...REP_RANGES, value]
      : REP_RANGES;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("exercise.rangeTitle")}
      description={t("exercise.rangeSub", { name })}
    >
      <div className="sheet-field rep-range-choice">
        <Segmented<string>
          label={t("exercise.rangeTitle")}
          value={value ? key(value) : ""}
          options={options.map((range) => ({
            value: key(range),
            label: label(range),
          }))}
          onChange={(chosen) =>
            onChange(options.find((range) => key(range) === chosen) ?? null)
          }
        />
      </div>
      <p className="sheet-hint">{t("exercise.rangeNote")}</p>
      {value && (
        <button
          type="button"
          className="text-button danger"
          onClick={() => onChange(null)}
        >
          {t("exercise.rangeClear")}
        </button>
      )}
      {count && (
        <div className="sheet-field">
          <span className="sheet-label" aria-hidden="true">
            {t("load.count")}
          </span>
          <Segmented<CountChoice>
            label={t("load.count")}
            value={count.value}
            options={count.options}
            onChange={count.onChange}
          />
          <p className="sheet-hint">{t("load.appliesUnchecked")}</p>
        </div>
      )}
      <button type="button" className="btn-primary btn-block" onClick={onClose}>
        {t("exercise.rangeDone")}
      </button>
    </Sheet>
  );
}
