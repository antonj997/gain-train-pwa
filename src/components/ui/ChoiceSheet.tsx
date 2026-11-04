import { Check } from "lucide-react";
import Sheet from "@/components/ui/Sheet";

type Option<T extends string> = { value: T; label: string };

/**
 * A short sheet that picks one of a few options, such as kg or lb. Choosing
 * applies at once and closes; the current option carries a check.
 */
export default function ChoiceSheet<T extends string>({
  open,
  onClose,
  title,
  options,
  value,
  hint,
  onChoose,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  options: Option<T>[];
  value: T;
  /** A line under the options, such as what the choice applies to. */
  hint?: string;
  onChoose: (value: T) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="sheet-menu" role="group" aria-label={title}>
        {options.map((option) => {
          const current = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              className={"sheet-menu-item" + (current ? " is-current" : "")}
              aria-pressed={current}
              onClick={() => {
                onChoose(option.value);
                onClose();
              }}
            >
              <span>{option.label}</span>
              {current && (
                <Check
                  size={20}
                  className="sheet-menu-check"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
      {hint && <p className="sheet-hint">{hint}</p>}
    </Sheet>
  );
}
