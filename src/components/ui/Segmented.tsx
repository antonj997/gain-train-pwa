import { useRef, type CSSProperties, type KeyboardEvent } from "react";
import { nextOptionIndex } from "@/lib/segmented-keys";

type Option<T extends string> = {
  value: T;
  label: string;
  /** A spoken name when the label is a symbol, such as "–" for none. */
  ariaLabel?: string;
  disabled?: boolean;
};

type Props<T extends string> = {
  /** Names the group for assistive technology. */
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  /**
   * An option that stays neutral when chosen ("Ingen" in a level picker): it
   * is selected, but not drawn in the selected look.
   */
  neutral?: T;
};

/** A radio group drawn as joined buttons. Styles live in styles/components.css. */
export default function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  neutral,
}: Props<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // One tab stop: the checked option, or the first enabled one when that is disabled.
  const checked = options.findIndex((o) => o.value === value && !o.disabled);
  const tabStop =
    checked >= 0 ? checked : options.findIndex((o) => !o.disabled);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    // Leave shortcuts such as Alt+Left (browser back) alone.
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = nextOptionIndex(options, index, event.key);
    if (next === null) return;
    event.preventDefault();
    buttons.current[next]?.focus();
    onChange(options[next].value);
  };

  // One thumb under the options slides to the selected one (styles/components.css).
  const selected = options.findIndex((o) => o.value === value);
  const thumb = {
    "--seg-count": options.length,
    "--seg-index": Math.max(0, selected),
  } as CSSProperties;

  return (
    <div
      className="segmented"
      role="radiogroup"
      aria-label={label}
      style={thumb}
    >
      {selected >= 0 && (
        <span
          className={
            "segmented-thumb" +
            (options[selected].disabled ? " is-disabled" : "") +
            (neutral !== undefined && options[selected].value === neutral
              ? " is-neutral"
              : "")
          }
          aria-hidden="true"
        />
      )}
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(node) => {
            buttons.current[index] = node;
          }}
          type="button"
          className={
            "seg-option" + (option.value === neutral ? " is-neutral" : "")
          }
          role="radio"
          aria-checked={option.value === value}
          aria-label={option.ariaLabel}
          tabIndex={index === tabStop ? 0 : -1}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
