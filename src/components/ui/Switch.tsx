type Props = {
  label: string;
  /** A short line under the label. */
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

/** A labelled on/off switch; the whole row is the button. Styles live in styles/components.css. */
export default function Switch({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="switch"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      {hint ? (
        <span className="switch-text">
          <span className="switch-label">{label}</span>
          <small className="switch-hint">{hint}</small>
        </span>
      ) : (
        <span className="switch-label">{label}</span>
      )}
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
    </button>
  );
}
