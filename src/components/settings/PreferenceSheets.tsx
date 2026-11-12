import { Minus, Moon, Plus, Sun } from "lucide-react";
import { useTheme } from "@/contexts/useTheme";
import { LANGUAGES, LANGUAGE_NAMES } from "@/i18n";
import { useT } from "@/i18n/useT";
import { RestSettings } from "@/components/settings/RestControl";
import Sheet from "@/components/ui/Sheet";
import Switch from "@/components/ui/Switch";
import { canVibrate, type TrainingPreferences } from "@/lib/preferences";

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
        label={t("settings.setGoal")}
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

export function RestSheet({
  open,
  onClose,
  preferences,
  onChange,
}: SheetProps) {
  const { t } = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t("settings.restTimer")}>
      <RestSettings preferences={preferences} onChange={onChange} />
      <button type="button" className="btn-primary" onClick={onClose}>
        {t("common.done")}
      </button>
    </Sheet>
  );
}

/** Vibrate on a checked set; iPhone Safari has no vibration, so it is hidden there. */
export function VibrateSetting({
  preferences,
  onChange,
}: Pick<SheetProps, "preferences" | "onChange">) {
  const { t } = useT();
  if (!canVibrate()) return null;
  return (
    <div className="rest-setting">
      <Switch
        label={t("settings.vibrate")}
        hint={t("settings.vibrateNote")}
        checked={preferences.haptics}
        onChange={(haptics) => onChange({ haptics })}
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
