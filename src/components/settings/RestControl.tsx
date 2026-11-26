import { Minus, Plus } from "lucide-react";
import Switch from "@/components/ui/Switch";
import Reveal from "@/components/motion/Reveal";
import { useT } from "@/i18n/useT";
import {
  MAX_REST_SECONDS,
  canVibrate,
  restLabel,
  stepRest,
  type TrainingPreferences,
} from "@/lib/preferences";
import { switchRestTimer } from "@/lib/rest-timer-switch";

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
 * Settings → Vilotimer (v6 §G1): the switch, and under it "Ljud när vilan är
 * slut" and "Vibrera", which show only while it is on. No time here: times
 * are per exercise (the tiers, or the exercise's own in the workout).
 * Switching saves through switchRestTimer, which keeps a saved time.
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
  const on = preferences.restOn;
  return (
    <>
      <div className="rest-setting">
        <Switch
          label={t("settings.restTimer")}
          hint={t("settings.restTimerNote")}
          checked={on}
          onChange={(next) => {
            switchRestTimer(next);
            onChange({});
          }}
        />
      </div>
      <Reveal className="rest-setting-more">
        {on && (
          <>
            <div className="rest-setting rest-setting-sub">
              <Switch
                label={t("settings.restSound")}
                checked={preferences.restSound}
                onChange={(restSound) => onChange({ restSound })}
              />
            </div>
            {/* iPhone Safari cannot vibrate, so the row is left out there. */}
            {canVibrate() && (
              <div className="rest-setting rest-setting-sub">
                <Switch
                  label={t("settings.vibrate")}
                  checked={preferences.haptics}
                  onChange={(haptics) => onChange({ haptics })}
                />
              </div>
            )}
          </>
        )}
      </Reveal>
    </>
  );
}
