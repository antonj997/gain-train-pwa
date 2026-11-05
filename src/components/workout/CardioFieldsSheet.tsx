import Sheet from "@/components/ui/Sheet";
import Segmented from "@/components/ui/Segmented";
import Switch from "@/components/ui/Switch";
import {
  CARDIO_METRICS,
  DISTANCE_UNITS,
  paceUnit,
  withMetric,
  type CardioFields,
  type CardioMetric,
  type DistanceUnit,
} from "@/lib/cardio";
import { useT } from "@/i18n/useT";
import type { MessageKey } from "@/i18n";

const LABELS: Record<CardioMetric, MessageKey> = {
  time: "cardio.metricTime",
  distance: "cardio.metricDistance",
  pace: "cardio.metricPace",
  level: "cardio.metricLevel",
  incline: "cardio.metricIncline",
  calories: "cardio.metricCalories",
  heartRate: "cardio.metricHeartRate",
};

/**
 * "Fields…" of a cardio exercise: which fields its rows show and the unit its
 * distance is typed in. A change applies at once and is saved for the
 * exercise; values already in a field that is turned off stay saved.
 */
export default function CardioFieldsSheet({
  open,
  onClose,
  name,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  value: CardioFields;
  onChange: (fields: CardioFields) => void;
}) {
  const { t } = useT();
  const hint = (metric: CardioMetric) =>
    metric === "time"
      ? t("cardio.timeAlways")
      : metric === "pace"
        ? t("cardio.paceHint", { unit: paceUnit(value.distanceUnit) })
        : metric === "level"
          ? t("cardio.levelHint")
          : metric === "heartRate"
            ? t("cardio.heartRateHint")
            : undefined;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("cardio.fieldsTitle")}
      description={t("cardio.fieldsNote", { name })}
      className="cardio-fields-sheet"
    >
      <div className="cardio-field-list">
        {CARDIO_METRICS.map((metric) => (
          <div key={metric} className="cardio-field-option">
            <Switch
              label={t(LABELS[metric])}
              hint={hint(metric)}
              checked={value.fields.includes(metric)}
              disabled={metric === "time"}
              onChange={(on) => onChange(withMetric(value, metric, on))}
            />
            {metric === "distance" && value.fields.includes("distance") && (
              <div className="sheet-field cardio-unit">
                <span className="sheet-label" aria-hidden="true">
                  {t("cardio.distanceUnit")}
                </span>
                <Segmented<DistanceUnit>
                  label={t("cardio.distanceUnit")}
                  value={value.distanceUnit}
                  options={DISTANCE_UNITS.map((unit) => ({
                    value: unit,
                    label: unit,
                  }))}
                  onChange={(distanceUnit) =>
                    onChange({ ...value, distanceUnit })
                  }
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </Sheet>
  );
}
