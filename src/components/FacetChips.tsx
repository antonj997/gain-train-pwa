const label = (value: string) => value[0].toUpperCase() + value.slice(1);

/** One scrolling row of filter chips. The first chip, All, clears the choice. */
export default function FacetChips({
  name,
  options,
  value,
  onChange,
}: {
  /** Names the group for assistive technology, e.g. "Category". */
  name: string;
  options: readonly string[];
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
          {option ? label(option) : `All ${name.toLowerCase()}`}
        </button>
      ))}
    </div>
  );
}
