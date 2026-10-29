import { Minus, Moon, Plus, Sun } from "lucide-react";
import { useTheme } from "@/contexts/useTheme";
import Segmented from "@/components/ui/Segmented";
import Sheet from "@/components/ui/Sheet";
import Switch from "@/components/ui/Switch";
import {
  canVibrate,
  restLabel,
  type TrainingPreferences,
} from "@/lib/preferences";

type Preferences = TrainingPreferences;
type SheetProps = {
  open: boolean;
  onClose: () => void;
  preferences: Preferences;
  onChange: (patch: Partial<Preferences>) => void;
};

const REST_OPTIONS = [0, 30, 60, 90, 120, 180];

export function GoalSheet({
  open,
  onClose,
  preferences,
  onChange,
}: SheetProps) {
  const goal = preferences.weeklyGoal;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Weekly goal"
      description="How many workouts you aim for each week, Monday to Sunday."
    >
      <Switch
        label="Set a weekly goal"
        checked={goal !== null}
        onChange={(on) => onChange({ weeklyGoal: on ? 3 : null })}
      />
      {goal !== null && (
        <div className="stepper">
          <button
            type="button"
            className="icon-btn filled"
            aria-label="One fewer workout"
            disabled={goal <= 1}
            onClick={() => onChange({ weeklyGoal: goal - 1 })}
          >
            <Minus size={20} aria-hidden="true" />
          </button>
          <output aria-live="polite">
            <strong>{goal}</strong> {goal === 1 ? "workout" : "workouts"} a week
          </output>
          <button
            type="button"
            className="icon-btn filled"
            aria-label="One more workout"
            disabled={goal >= 14}
            onClick={() => onChange({ weeklyGoal: goal + 1 })}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        </div>
      )}
      <button className="btn-primary" onClick={onClose}>
        Done
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
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Rest timer"
      description="Starts after checking a set as done."
    >
      <Segmented
        label="Rest time"
        value={String(preferences.restSeconds)}
        options={REST_OPTIONS.map((seconds) => ({
          value: String(seconds),
          label: restLabel(seconds),
        }))}
        onChange={(value) => onChange({ restSeconds: Number(value) })}
      />
      {/* iPhone Safari has no vibration, so the setting would do nothing there. */}
      {canVibrate() && (
        <>
          <Switch
            label="Vibrate when a set is done"
            checked={preferences.haptics}
            onChange={(haptics) => onChange({ haptics })}
          />
          <p className="small-note">
            Vibration is off by default and works on supported devices.
          </p>
        </>
      )}
    </Sheet>
  );
}

export function ThemeSheet({
  open,
  onClose,
}: Pick<SheetProps, "open" | "onClose">) {
  const { theme, toggleTheme } = useTheme();
  return (
    <Sheet open={open} onClose={onClose} title="Theme">
      <div className="theme-setting">
        <p>{theme === "dark" ? "Dark" : "Light"}</p>
        <button
          type="button"
          role="switch"
          aria-checked={theme === "light"}
          aria-label="Light appearance"
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
