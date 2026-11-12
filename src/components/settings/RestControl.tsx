import { Minus, Plus } from "lucide-react";
import Switch from "@/components/ui/Switch";
import { useT } from "@/i18n/useT";
import {
  MAX_REST_SECONDS,
  restLabel,
  saveRestTimerOn,
  stepRest,
  type TrainingPreferences,
} from "@/lib/preferences";

/**
 * The one control for a rest time: − 2:00 +. Settings and the workout's rest
 * chip both use it, so the time is set the same way everywhere.
 */
export function RestControl({
  seconds,
  onChange,
}: {
  seconds: number;
  onChange: (seconds: number) => void;
}) {
  const { t } = useT();
  return (
    <div
      className="rest-control"
      role="group"
      aria-label={t("settings.restTime")}
    >
      <button
        type="button"
        className="rest-control-step"
        aria-label={t("settings.restShorter")}
        disabled={seconds <= 15}
        onClick={() => onChange(stepRest(seconds, -1))}
      >
        <Minus size={18} aria-hidden="true" />
      </button>
      <output className="rest-control-value" aria-live="polite">
        {restLabel(seconds)}
      </output>
      <button
        type="button"
        className="rest-control-step"
        aria-label={t("settings.restLonger")}
        disabled={seconds >= MAX_REST_SECONDS}
        onClick={() => onChange(stepRest(seconds, 1))}
      >
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * The rest timer as a plain on/off switch; its time shows only while it is on.
 * Off keeps the time it had, for when it is switched on again.
 */
export function RestSettings({
  preferences,
  onChange,
}: {
  preferences: TrainingPreferences;
  /** Saves a change; an empty one only re-reads what was saved. */
  onChange: (patch: Partial<TrainingPreferences>) => void;
}) {
  const { t } = useT();
  const on = preferences.restSeconds > 0;
  return (
    <>
      <div className="rest-setting">
        <Switch
          label={t("settings.restTimer")}
          hint={t("settings.restDescription")}
          checked={on}
          onChange={(next) => {
            saveRestTimerOn(next);
            onChange({});
          }}
        />
      </div>
      {on && (
        <div className="rest-setting rest-setting-time">
          <span className="rest-setting-label" aria-hidden="true">
            {t("settings.restTime")}
          </span>
          <RestControl
            seconds={preferences.restSeconds}
            onChange={(restSeconds) => onChange({ restSeconds })}
          />
        </div>
      )}
    </>
  );
}
