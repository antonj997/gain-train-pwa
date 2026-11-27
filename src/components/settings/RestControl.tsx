import { useState } from "react";
import { ChevronRight, Minus, Plus } from "lucide-react";
import Switch from "@/components/ui/Switch";
import Reveal from "@/components/motion/Reveal";
import Sheet from "@/components/ui/Sheet";
import Segmented from "@/components/ui/Segmented";
import { useT } from "@/i18n/useT";
import {
  MAX_REST_SECONDS,
  canVibrate,
  restLabel,
  stepRest as defaultStepRest,
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
  step,
}: {
  seconds: number;
  onChange: (seconds: number) => void;
  /** Even steps of this many seconds (v6 B8: 15), else stepRest's. */
  step?: number;
}) {
  const { t } = useT();
  const stepRest = (value: number, direction: 1 | -1) =>
    step
      ? Math.min(
          MAX_REST_SECONDS,
          Math.max(step, Math.round(value / step) * step + direction * step),
        )
      : defaultStepRest(value, direction);
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

/** The times the rest sheet offers on one row (v6 B8). */
const REST_CHOICES = [60, 90, 120, 150, 180, 240, 300] as const;

/**
 * The workout's rest sheet (v6 B8), from an exercise's rest chip or its ⋯:
 * "Använd vilotimer", the time (one row 1:00–5:00, "Egen tid" for 15 s steps
 * to 10:00), the default note, "Gäller" (only this exercise, or all), and
 * the sound and vibration while the timer is on. "Bara …" writes the
 * exercise's own rest; "Alla övningar" sets the preference and removes it.
 */
export function RestSheet({
  open,
  onClose,
  name,
  preferences,
  onPreferences,
  seconds,
  own,
  tier,
  onOwn,
}: {
  open: boolean;
  onClose: () => void;
  /** The exercise's name, the sheet's subline. */
  name: string;
  preferences: TrainingPreferences;
  /** Saves a preference change; an empty one only re-reads what was saved. */
  onPreferences: (patch: Partial<TrainingPreferences>) => void;
  /** The exercise's effective rest (effectiveRest), 0 = no timer. */
  seconds: number;
  /** Its own rest, or undefined while it follows the preference. */
  own: number | undefined;
  /** Its tier (rest-tiers.ts): the time a timer switched on starts with. */
  tier: number;
  /** Sets its own rest, or null to follow the preference. */
  onOwn: (seconds: number | null) => void;
}) {
  const { t } = useT();
  const [scope, setScope] = useState<"own" | "all">(
    own !== undefined ? "own" : "all",
  );
  const [custom, setCustom] = useState(false);
  // The sheet opens on where the exercise's time comes from.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setScope(own !== undefined ? "own" : "all");
      setCustom(false);
    }
  }
  const on = seconds > 0;
  const startTime =
    seconds > 0
      ? seconds
      : preferences.restSeconds > 0
        ? preferences.restSeconds
        : tier;
  const setAll = (patch: Partial<TrainingPreferences>) => {
    onPreferences(patch);
    if (own !== undefined) onOwn(null);
  };
  const toggle = (next: boolean) => {
    if (scope === "own") onOwn(next ? startTime : 0);
    else {
      switchRestTimer(next);
      setAll({});
    }
  };
  const choose = (value: number) =>
    scope === "own"
      ? onOwn(value)
      : setAll({ restOn: true, restSeconds: value });
  const changeScope = (next: "own" | "all") => {
    setScope(next);
    if (next === "own") onOwn(seconds);
    else
      setAll({
        restOn: true,
        restSeconds: seconds > 0 ? seconds : preferences.restSeconds,
      });
  };
  const onlyHere = !preferences.restOn && (own ?? 0) > 0;
  const chosen = (REST_CHOICES as readonly number[]).includes(seconds)
    ? String(seconds)
    : "";
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("rest.sheetTitle")}
      description={name}
    >
      <div className="list rest-sheet-group">
        <div className="rest-setting">
          <Switch
            label={t("rest.use")}
            hint={onlyHere ? t("rest.useOwn") : t("rest.useOff")}
            checked={on}
            onChange={toggle}
          />
        </div>
      </div>
      <div className="sheet-field">
        <span className="sheet-label" aria-hidden="true">
          {t("rest.time")}
        </span>
        <Segmented<string>
          label={t("rest.time")}
          value={chosen}
          options={REST_CHOICES.map((value) => ({
            value: String(value),
            label: restLabel(value),
          }))}
          onChange={(value) => choose(Number(value))}
        />
      </div>
      <div className="list rest-sheet-group">
        <button
          type="button"
          className="row"
          aria-expanded={custom}
          onClick={() => setCustom((value) => !value)}
        >
          <span className="row-main">
            <span className="row-title">{t("rest.custom")}</span>
          </span>
          {on && !chosen && (
            <span className="row-value">{restLabel(seconds)}</span>
          )}
          <ChevronRight
            className={`chev${custom ? " is-open" : ""}`}
            size={20}
            aria-hidden="true"
          />
        </button>
        <Reveal>
          {custom && (
            <div className="rest-setting rest-setting-time">
              <RestControl seconds={startTime} step={15} onChange={choose} />
            </div>
          )}
        </Reveal>
      </div>
      <p className="sheet-hint">{t("rest.defaults")}</p>
      <div className="sheet-field">
        <span className="sheet-label" aria-hidden="true">
          {t("rest.applies")}
        </span>
        <Segmented<"own" | "all">
          label={t("rest.applies")}
          value={scope}
          options={[
            {
              value: "own",
              label: t("rest.onlyThis", { name: name.toLocaleLowerCase() }),
            },
            { value: "all", label: t("rest.all") },
          ]}
          onChange={changeScope}
        />
      </div>
      <Reveal>
        {on && (
          <div className="list rest-sheet-group">
            <div className="rest-setting">
              <Switch
                label={t("rest.sound")}
                checked={preferences.restSound}
                onChange={(restSound) => onPreferences({ restSound })}
              />
            </div>
            {canVibrate() && (
              <div className="rest-setting">
                <Switch
                  label={t("rest.vibrate")}
                  checked={preferences.haptics}
                  onChange={(haptics) => onPreferences({ haptics })}
                />
              </div>
            )}
          </div>
        )}
      </Reveal>
      <button type="button" className="btn-primary btn-block" onClick={onClose}>
        {t("rest.done")}
      </button>
    </Sheet>
  );
}
