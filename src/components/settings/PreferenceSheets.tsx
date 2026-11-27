import { useId } from "react";
import { Minus, Moon, Plus, Sun } from "lucide-react";
import Reveal from "@/components/motion/Reveal";
import { useTheme } from "@/contexts/useTheme";
import { LANGUAGES, LANGUAGE_NAMES } from "@/i18n";
import { useT } from "@/i18n/useT";
import Sheet from "@/components/ui/Sheet";
import Segmented from "@/components/ui/Segmented";
import Switch from "@/components/ui/Switch";
import type { MapFigure } from "@/components/muscles/detailed-geometry";
import { useMapFigure } from "@/hooks/useMapFigure";
import { type FatigueMode, type TrainingPreferences } from "@/lib/preferences";

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
 * Settings → Coach (v6 §G1): "Tips i passet" (the warm-up and drop rows in
 * the Set sheet, on by default) and "Trött muskel sent i passet" (decision
 * 2: Av | Föreslå | Automatiskt, Föreslå by default; the workout's fatigue
 * row reads it).
 */
export function CoachSettings({
  preferences,
  onChange,
}: Pick<SheetProps, "preferences" | "onChange">) {
  const { t } = useT();
  return (
    <>
      <div className="rest-setting">
        <Switch
          label={t("settings.workoutTips")}
          hint={t("settings.workoutTipsNote")}
          checked={preferences.workoutTips}
          onChange={(workoutTips) => onChange({ workoutTips })}
        />
      </div>
      <div className="rest-setting coach-fatigue">
        <span className="row-main">
          <span className="rest-setting-label">{t("settings.fatigue")}</span>
          <span className="row-sub">{t("settings.fatigueNote")}</span>
        </span>
        <Segmented<FatigueMode>
          label={t("settings.fatigue")}
          value={preferences.fatigueMode}
          options={[
            { value: "off", label: t("settings.fatigueOff") },
            { value: "suggest", label: t("settings.fatigueSuggest") },
            { value: "auto", label: t("settings.fatigueAuto") },
          ]}
          onChange={(fatigueMode) => onChange({ fatigueMode })}
        />
      </div>
    </>
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

/**
 * Settings → Utseende → Tema (v6 §G1): the whole row is the switch, with the
 * day/night switch drawn inside it. A tap toggles day and night (650 ms);
 * the value says whether it follows the phone. After a choice by hand a row
 * under it offers "Följ telefonen igen".
 */
export function ThemeSetting() {
  const { theme, toggleTheme, chosen, followPhone } = useTheme();
  const { t } = useT();
  const valueId = useId();
  const light = theme === "light";
  const value = chosen
    ? t(light ? "settings.light" : "settings.dark")
    : t(light ? "settings.themeFollowsLight" : "settings.themeFollowsDark");
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={light}
        aria-label={t("settings.themeSwitch")}
        aria-describedby={valueId}
        className="row theme-row"
        onClick={toggleTheme}
      >
        <span className="row-main">
          <span className="row-title">{t("settings.theme")}</span>
          <span className="row-sub" id={valueId}>
            {value}
          </span>
        </span>
        <span
          className={"theme-switch " + (light ? "is-day" : "is-night")}
          aria-hidden="true"
        >
          <span className="theme-stars">✦ · ✧</span>
          <span className="theme-orb">
            <Moon className="theme-moon" size={22} />
            <Sun className="theme-sun" size={24} />
          </span>
          <span className="theme-horizon" />
        </span>
      </button>
      <Reveal>
        {chosen && (
          <div className="row theme-follow">
            <span className="row-main row-sub">
              {t("settings.themeChosen")}
            </span>
            <button type="button" className="text-link" onClick={followPhone}>
              {t("settings.themeFollowAgain")}
            </button>
          </div>
        )}
      </Reveal>
    </>
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
  const { t, setLanguage, followsPhone } = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t("settings.languageRow")}>
      <LanguageChoices
        onChoose={(language) => {
          setLanguage(language);
          onClose();
        }}
      />
      {followsPhone && (
        <p className="row-sub">{t("settings.languageFollowsNote")}</p>
      )}
    </Sheet>
  );
}
