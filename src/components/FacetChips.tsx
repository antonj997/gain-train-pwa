const capital = (value: string) =>
  value.charAt(0).toLocaleUpperCase() + value.slice(1);

/** One scrolling row of filter chips. The first chip, All, clears the choice. */
export default function FacetChips({
  name,
  allLabel,
  options,
  format = (option) => option,
  value,
  onChange,
}: {
  /** Names the group for assistive technology, e.g. "Category". */
  name: string;
  /** The first chip, which clears the choice: "All equipment". */
  allLabel: string;
  options: readonly string[];
  /** The label of a stored option value. */
  format?: (option: string) => string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="facet-chips" role="group" aria-label={name}>
      {["", ...options].map((option) => (
        <button
          key={option}
          type="button"
          className="filter-chip"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {option ? capital(format(option)) : allLabel}
        </button>
      ))}
    </div>
  );
}
