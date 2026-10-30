import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import {
  createSetInputSelection,
  parseSetNumber,
  isSetInputEditKey,
} from "../lib/set-input";
import { formatDecimal } from "../i18n";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> & {
  value: number | null;
  onValueChange: (value: number | null, unfinishedText?: string) => void;
  inputText?: string;
  onLockedAttempt?: () => void;
  /** Text to number, NaN while unfinished. Defaults to a plain decimal number. */
  parse?: (text: string) => number | null;
  /** The text shown for a value. Defaults to the number itself. */
  format?: (value: number | null) => string;
};

// Shown with the language's decimal mark; typing accepts both "," and ".".
const plainText = (value: number | null) =>
  value === null || !Number.isFinite(value) ? "" : formatDecimal(value);

export default function SetNumberInput({
  value,
  inputText,
  onValueChange,
  onLockedAttempt,
  onBlur,
  parse = parseSetNumber,
  format = plainText,
  className = "",
  ...props
}: Props) {
  const textFor = (v: number | null) =>
    v === null || !Number.isFinite(v) ? "" : format(v);
  const [draft, setDraft] = useState({
    value,
    inputText,
    text: inputText ?? textFor(value),
  });
  if (!Object.is(value, draft.value) || inputText !== draft.inputText)
    setDraft({ value, inputText, text: inputText ?? textFor(value) });
  const warning = useRef(onLockedAttempt);
  warning.current = onLockedAttempt;
  const selection = useRef(
    createSetInputSelection(undefined, () => warning.current?.()),
  );
  useEffect(() => {
    const current = selection.current;
    return () => current.dispose();
  }, []);
  return (
    <input
      {...props}
      onPointerDown={selection.current.onPointerDown}
      onPointerMove={selection.current.onPointerMove}
      onPointerUp={selection.current.onPointerUp}
      onPointerCancel={selection.current.onPointerCancel}
      onLostPointerCapture={selection.current.onLostPointerCapture}
      onClick={selection.current.onClick}
      className={`set-number-input ${className}`.trim()}
      type="text"
      dir="ltr"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      maxLength={32}
      value={draft.text}
      onFocus={(event) => {
        if (props.readOnly) onLockedAttempt?.();
        else event.currentTarget.select();
      }}
      onKeyDown={(event) => {
        if (props.readOnly && isSetInputEditKey(event)) {
          event.preventDefault();
          onLockedAttempt?.();
        }
      }}
      onBlur={(event) => {
        if (
          inputText === undefined &&
          (value === null || Number.isFinite(value))
        )
          setDraft({ value, inputText, text: textFor(value) });
        onBlur?.(event);
      }}
      onChange={(event) => {
        if (props.readOnly) {
          onLockedAttempt?.();
          return;
        }
        const text = event.target.value;
        const parsed = parse(text);
        const unfinished =
          typeof parsed === "number" && !Number.isFinite(parsed);
        const next = unfinished ? null : parsed;
        const nextInputText = unfinished ? text : undefined;
        setDraft({ value: next, inputText: nextInputText, text });
        onValueChange(next, nextInputText);
      }}
    />
  );
}
