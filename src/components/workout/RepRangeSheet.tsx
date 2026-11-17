import { useEffect, useState } from "react";
import type { Exercise } from "@/data/model";
import Sheet from "@/components/ui/Sheet";
import Reveal from "@/components/motion/Reveal";
import { useT } from "@/i18n/useT";

type Range = NonNullable<Exercise["repRange"]>;

/** A whole number from typed text, or null. */
const whole = (text: string) =>
  /^\d{1,4}$/.test(text.trim()) ? Number(text.trim()) : null;

/**
 * A routine exercise's rep range, such as 8–12: two whole numbers, the first
 * no larger than the second. It is shown in the routine and its preview;
 * weights and reps still come from history.
 */
export default function RepRangeSheet({
  open,
  name,
  value,
  onClose,
  onChange,
}: {
  open: boolean;
  name: string;
  value: Range | undefined;
  onClose: () => void;
  /** The new range, or null to remove it. */
  onChange: (range: Range | null) => void;
}) {
  const { t } = useT();
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    if (!open) return;
    setMin(value ? String(value.min) : "");
    setMax(value ? String(value.max) : "");
    setInvalid(false);
    // The fields start from the range each time the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const save = () => {
    const low = whole(min);
    const high = whole(max === "" ? min : max);
    if (low === null || high === null || low < 1 || high < low) {
      setInvalid(true);
      return;
    }
    onChange({ min: low, max: high });
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("repRange.title", { name })}
      description={t("repRange.hint")}
    >
      <div className="rep-range-fields">
        <label>
          {t("repRange.min")}
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="8"
            value={min}
            aria-invalid={invalid || undefined}
            onChange={(e) => setMin(e.target.value)}
          />
        </label>
        <span aria-hidden="true">–</span>
        <label>
          {t("repRange.max")}
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="12"
            value={max}
            aria-invalid={invalid || undefined}
            onChange={(e) => setMax(e.target.value)}
          />
        </label>
      </div>
      <Reveal>
        {invalid && (
          <p className="field-error" role="alert">
            {t("repRange.invalid")}
          </p>
        )}
      </Reveal>
      <button type="button" className="btn-primary btn-block" onClick={save}>
        {t("common.save")}
      </button>
      {value && (
        <button
          type="button"
          className="text-button danger"
          onClick={() => {
            onChange(null);
            onClose();
          }}
        >
          {t("repRange.clear")}
        </button>
      )}
    </Sheet>
  );
}
