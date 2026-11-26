import { Minus, Moon, Plus, Sun } from "lucide-react";
import { useTheme } from "@/contexts/useTheme";
import { LANGUAGES, LANGUAGE_NAMES } from "@/i18n";
import { useT } from "@/i18n/useT";
import { RestControl } from "@/components/settings/RestControl";
import Sheet from "@/components/ui/Sheet";
import Segmented from "@/components/ui/Segmented";
import Switch from "@/components/ui/Switch";
import type { MapFigure } from "@/components/muscles/detailed-geometry";
import { useMapFigure } from "@/hooks/useMapFigure";
import { saveRestTimerOn, type TrainingPreferences } from "@/lib/preferences";

type Preferences = TrainingPreferences;
type SheetProps = {
  open: boolean;
  onClose: () => void;
  preferences: Preferences;
  onChange: (patch: Partial<Preferences>) => void;
};

export function GoalSheet({
  open,
  onClose,
  preferences,
  onChange,
}: SheetProps) {
  const goal = preferences.weeklyGoal;
  const { t } = useT();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("settings.weeklyGoal")}
      description={t("settings.goalDescription")}
    >
      <Switch
        label={t("common.on")}
        checked={goal !== null}
        onChange={(on) => onChange({ weeklyGoal: on ? 3 : null })}
      />
      {goal !== null && (
        <div className="stepper">
          <button
            type="button"
            className="icon-btn filled"
            aria-label={t("settings.fewerWorkout")}
            disabled={goal <= 1}
            onClick={() => onChange({ weeklyGoal: goal - 1 })}
          >
            <Minus size={20} aria-hidden="true" />
          </button>
          <output aria-live="polite">
            <strong>{goal}</strong> {t("settings.perWeekUnit", { count: goal })}
          </output>
          <button
            type="button"
            className="icon-btn filled"
            aria-label={t("settings.moreWorkout")}
            disabled={goal >= 14}
            onClick={() => onChange({ weeklyGoal: goal + 1 })}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        </div>
      )}
      <button className="btn-primary" onClick={onClose}>
        {t("common.done")}
      </button>
    </Sheet>
  );
}

/**
 * The workout's rest chip sheet as it was before v6: On, the time and the
 * sound. Settings no longer uses it (RestSettings has no time); it stays
 * until the workout's own rest sheet (v6 P1, RestControl.tsx) replaces it,
 * and can then be deleted.
 */
export function RestSheet({
  open,
  onClose,
  preferences,
  onChange,
}: SheetProps) {
  const { t } = useT();
  const on = preferences.restSeconds > 0;
  return (
    <Sheet open={open} onClose={onClose} title={t("settings.restTimer")}>
      <div className="rest-setting">
        <Switch
          label={t("common.on")}
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
      {on && (
        <div className="rest-setting rest-setting-sound">
          <Switch
            label={t("settings.restSound")}
            checked={preferences.restSound}
            onChange={(restSound) => onChange({ restSound })}
          />
        </div>
      )}
      <button type="button" className="btn-primary" onClick={onClose}>
        {t("common.done")}
      </button>
    </Sheet>
  );
}

/**
 * Settings → Coach (v6 §G1): "Tips i passet" (the warm-up and drop rows in
 * the Set sheet, on by default).
 */
export function CoachSettings({
  preferences,
  onChange,
}: Pick<SheetProps, "preferences" | "onChange">) {
  const { t } = useT();
  return (
    <div className="rest-setting">
      <Switch
        label={t("settings.workoutTips")}
        hint={t("settings.workoutTipsNote")}
        checked={preferences.workoutTips}
        onChange={(workoutTips) => onChange({ workoutTips })}
      />
    </div>
  );
}

/** After a checked set, offer reps in reserve for a few seconds (off by default). */
export function AskRirSetting({
  preferences,
  onChange,
}: Pick<SheetProps, "preferences" | "onChange">) {
  const { t } = useT();
  return (
    <div className="rest-setting">
      <Switch
        label={t("settings.askRir")}
        hint={t("settings.askRirNote")}
        checked={preferences.askRir}
        onChange={(askRir) => onChange({ askRir })}
      />
    </div>
  );
}

/** The muscle maps' figure, a man or a woman (the man by default), on this device. */
export function MapFigureSetting() {
  const { t } = useT();
  const [figure, setFigure] = useMapFigure();
  return (
    <div className="rest-setting map-figure-setting">
      <span className="row-main">
        <span className="rest-setting-label">{t("settings.mapFigure")}</span>
        <span className="row-sub">{t("settings.mapFigureNote")}</span>
      </span>
      <Segmented<MapFigure>
        label={t("settings.mapFigure")}
        value={figure}
        options={[
          { value: "m", label: t("mapFigure.m") },
          { value: "f", label: t("mapFigure.f") },
        ]}
        onChange={setFigure}
      />
    </div>
  );
}

export function ThemeSheet({
  open,
  onClose,
}: Pick<SheetProps, "open" | "onClose">) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t("settings.theme")}>
      <div className="theme-setting">
        <p>{theme === "dark" ? t("settings.dark") : t("settings.light")}</p>
        <button
          type="button"
          role="switch"
          aria-checked={theme === "light"}
          aria-label={t("settings.lightAppearance")}
          className={
            "theme-switch " + (theme === "light" ? "is-day" : "is-night")
          }
          onClick={toggleTheme}
        >
          <span className="theme-stars" aria-hidden="true">
            ✦ · ✧
          </span>
          <span className="theme-orb" aria-hidden="true">
            <Moon className="theme-moon" size={22} />
            <Sun className="theme-sun" size={24} />
          </span>
          <span className="theme-horizon" aria-hidden="true" />
        </button>
      </div>
    </Sheet>
  );
}

/** The language list: English and Svenska, each in its own language. */
export function LanguageChoices({
  onChoose,
}: {
  onChoose: (language: (typeof LANGUAGES)[number]) => void;
}) {
  const { language, chosen } = useT();
  return (
    <div className="language-choices">
      {LANGUAGES.map((option) => {
        const current = chosen && option === language;
        return (
          <button
            key={option}
            type="button"
            lang={option}
            className={current ? "btn-primary" : "btn-secondary"}
            aria-pressed={current}
            onClick={() => onChoose(option)}
          >
            {LANGUAGE_NAMES[option]}
          </button>
        );
      })}
    </div>
  );
}

export function LanguageSheet({
  open,
  onClose,
}: Pick<SheetProps, "open" | "onClose">) {
  const { t, setLanguage } = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t("language.title")}>
      <LanguageChoices
        onChoose={(language) => {
          setLanguage(language);
          onClose();
        }}
      />
    </Sheet>
  );
}
