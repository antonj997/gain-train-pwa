import type { LoadKey } from "@/lib/load-keys";
import type { CountChoice } from "@/lib/rep-hold";
import Sheet from "@/components/ui/Sheet";
import Segmented from "@/components/ui/Segmented";
import Switch from "@/components/ui/Switch";
import { useT } from "@/i18n/useT";

type Load = "weight" | "bodyweight" | "assisted";

type BodyProps = {
  /** The exercise's default load. */
  loadKey: LoadKey;
  /** Reps, reps with a hold field, or seconds. */
  count: CountChoice;
  /** "Reps + hold" is offered. */
  canHold?: boolean;
  onLoadKey: (key: LoadKey) => void;
  onCount: (count: CountChoice) => void;
  onDone: () => void;
};

const loadOf = (key: LoadKey): Load =>
  key === "weight" ? "weight" : key === "assisted" ? "assisted" : "bodyweight";

/** The Load and count sheet's content below its title. */
function LoadCountSheetBody({
  loadKey,
  count,
  canHold = false,
  onLoadKey,
  onCount,
  onDone,
}: BodyProps) {
  const timed = count === "seconds";
  const load = loadOf(loadKey);
  const { t } = useT();
  return (
    <>
      <div className="sheet-field">
        <span className="sheet-label" aria-hidden="true">
          {t("load.load")}
        </span>
        <Segmented<Load>
          label={t("load.load")}
          value={load}
          options={[
            { value: "weight", label: t("load.weight"), disabled: timed },
            { value: "bodyweight", label: t("load.bodyweight") },
            {
              value: "assisted",
              label: t("load.assisted"),
              disabled: timed,
            },
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
        {timed && <p className="sheet-hint">{t("load.timedBodyweight")}</p>}
        {load === "bodyweight" && (
          <Switch
            label={t("load.addExtra")}
            checked={loadKey === "bwplus"}
            onChange={(on) => onLoadKey(on ? "bwplus" : "bw")}
          />
        )}
      </div>
      <div className="sheet-field">
        <span className="sheet-label" aria-hidden="true">
          {t("load.count")}
        </span>
        <Segmented<CountChoice>
          label={t("load.count")}
          value={count}
          options={[
            { value: "reps", label: t("load.reps") },
            ...(canHold
              ? [{ value: "repsHold" as const, label: t("load.repsHold") }]
              : []),
            { value: "seconds", label: t("load.seconds") },
          ]}
          onChange={onCount}
        />
      </div>
      <p className="sheet-hint">{t("load.appliesUnchecked")}</p>
      <button type="button" className="btn-primary" onClick={onDone}>
        {t("common.done")}
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
  const { t } = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t("exercise.loadAndCount")}>
      <LoadCountSheetBody {...body} />
    </Sheet>
  );
}
