import type { LoadKey } from "@/lib/load-keys";
import Sheet from "@/components/ui/Sheet";
import Segmented from "@/components/ui/Segmented";
import Switch from "@/components/ui/Switch";

type Measure = "reps" | "seconds";
type Load = "weight" | "bodyweight" | "assisted";

type BodyProps = {
  /** The exercise's default load. */
  loadKey: LoadKey;
  measure: Measure;
  onLoadKey: (key: LoadKey) => void;
  onMeasure: (measure: Measure) => void;
  onDone: () => void;
};

const loadOf = (key: LoadKey): Load =>
  key === "weight" ? "weight" : key === "assisted" ? "assisted" : "bodyweight";

/** The Load and count sheet's content below its title. */
export function LoadCountSheetBody({
  loadKey,
  measure,
  onLoadKey,
  onMeasure,
  onDone,
}: BodyProps) {
  const timed = measure === "seconds";
  const load = loadOf(loadKey);
  return (
    <>
      <div className="sheet-field">
        <span className="sheet-label" aria-hidden="true">
          Load
        </span>
        <Segmented<Load>
          label="Load"
          value={load}
          options={[
            { value: "weight", label: "Weight", disabled: timed },
            { value: "bodyweight", label: "Bodyweight" },
            { value: "assisted", label: "Assisted", disabled: timed },
          ]}
          onChange={(next) =>
            onLoadKey(
              next === "bodyweight"
                ? "bw"
                : next === "weight"
                  ? "weight"
                  : "assisted",
            )
          }
        />
        {timed && <p className="sheet-hint">Timed sets use bodyweight</p>}
        {load === "bodyweight" && (
          <Switch
            label="Add extra weight"
            checked={loadKey === "bwplus"}
            onChange={(on) => onLoadKey(on ? "bwplus" : "bw")}
          />
        )}
      </div>
      <div className="sheet-field">
        <span className="sheet-label" aria-hidden="true">
          Count
        </span>
        <Segmented<Measure>
          label="Count"
          value={measure}
          options={[
            { value: "reps", label: "Reps" },
            { value: "seconds", label: "Seconds" },
          ]}
          onChange={onMeasure}
        />
      </div>
      <p className="sheet-hint">
        Applies to the sets you haven&apos;t checked yet.
      </p>
      <button type="button" className="btn-primary" onClick={onDone}>
        Done
      </button>
    </>
  );
}

/** The sheet the load and count headings open. */
export default function LoadCountSheet({
  open,
  onClose,
  ...body
}: BodyProps & { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Load and count">
      <LoadCountSheetBody {...body} />
    </Sheet>
  );
}
