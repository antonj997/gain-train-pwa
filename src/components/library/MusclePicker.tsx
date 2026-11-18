import { useState } from "react";
import EquipmentIcon from "@/components/muscles/EquipmentIcon";
import MuscleIcon from "@/components/muscles/MuscleIcon";
import MuscleMap from "@/components/muscles/MuscleMap";
import Reveal from "@/components/motion/Reveal";
import Segmented from "@/components/ui/Segmented";
import {
  CUSTOM_ICONS,
  customIconOf,
  groupMuscles,
  isCardioExercise,
  type CustomIcon,
} from "@/data/exercise-muscles";
import type { CustomExercise } from "@/data/model";
import type { Muscle } from "@/data/muscles";
import type { MuscleGroup } from "@/data/muscle-sets";
import { useMapFigure } from "@/hooks/useMapFigure";
import {
  categoryLabel,
  equipmentLabel,
  muscleLabel,
} from "@/lib/catalogue-labels";
import { categoryTone } from "@/lib/exercise-icon";
import { exerciseMapFills } from "@/lib/muscle-figure";
import {
  LEVEL_CHOICES,
  groupChoice,
  muscleChoice,
  pickerMuscles,
  withGroupChoice,
  withMuscleChoice,
  type LevelChoice,
} from "@/lib/muscle-picker";
import { t } from "@/i18n";

/** The simple picker's order: Chest, Back, Shoulders, Arms, Legs, Glutes, Core. */
const GROUPS: readonly MuscleGroup[] = [
  "Chest",
  "Back",
  "Shoulders",
  "Arms",
  "Legs",
  "Glutes",
  "Core",
];

type Mode = "simple" | "advanced";

/** One row: a name (with "Mixed" when its muscles differ) and – / Lite / Mycket. */
function LevelRow({
  name,
  value,
  onChange,
}: {
  name: string;
  value: LevelChoice | "mixed";
  onChange: (choice: LevelChoice) => void;
}) {
  return (
    <div className="level-row">
      <span className="level-row-name">
        {name}
        {value === "mixed" && (
          <span className="level-row-mixed">{t("muscles.mixed")}</span>
        )}
      </span>
      <Segmented<LevelChoice | "mixed">
        label={name}
        value={value}
        options={LEVEL_CHOICES.map((choice) => ({
          value: choice,
          label: t(`muscles.level.${choice}`),
          ariaLabel:
            choice === "none" ? t("muscles.level.noneSpoken") : undefined,
        }))}
        onChange={(choice) => choice !== "mixed" && onChange(choice)}
      />
    </div>
  );
}

const iconLabel = (icon: CustomIcon) =>
  icon === "body" ? t("muscles.iconBody") : equipmentLabel(icon);

/**
 * The custom-exercise editor's Muscles and Icon sections: a small live map of
 * the chosen muscles, a Simple | Advanced picker (groups or single muscles,
 * each – / Lite / Mycket) and the icon tiles. Until something is changed the
 * picker shows the muscles of the exercise's categories.
 */
export default function MusclePicker({
  data,
  onChange,
}: {
  data: CustomExercise;
  onChange: (data: CustomExercise) => void;
}) {
  const [mode, setMode] = useState<Mode>("simple");
  const [figure] = useMapFigure();
  const { muscles, chosen } = pickerMuscles(data);
  const { fills, rank } = exerciseMapFills(muscles);
  const icon = customIconOf(data);
  const tone = categoryTone(data.category);
  const cardio = isCardioExercise(data);
  return (
    <>
      <div className="plan-field muscle-picker">
        <span className="group-title" id="exercise-muscles-title">
          {t("muscles.title")}
        </span>
        <div className="muscle-map muscle-map-preview">
          <MuscleMap fills={fills} rank={rank} figure={figure} />
        </div>
        <Reveal>
          {!chosen && <p className="row-sub">{t("muscles.fromCategories")}</p>}
        </Reveal>
        <Segmented<Mode>
          label={t("muscles.title")}
          value={mode}
          options={[
            { value: "simple", label: t("muscles.simple") },
            { value: "advanced", label: t("muscles.advanced") },
          ]}
          onChange={setMode}
        />
        <Reveal>
          {mode === "simple" && (
            <div
              className="level-rows"
              role="group"
              aria-labelledby="exercise-muscles-title"
            >
              {GROUPS.map((group) => (
                <LevelRow
                  key={group}
                  name={categoryLabel(group)}
                  value={groupChoice(data, group)}
                  onChange={(choice) =>
                    onChange(withGroupChoice(data, group, choice))
                  }
                />
              ))}
            </div>
          )}
        </Reveal>
        <Reveal>
          {mode === "advanced" && (
            <div className="level-groups">
              {GROUPS.map((group) => (
                <div
                  key={group}
                  className="level-rows"
                  role="group"
                  aria-labelledby={`muscle-group-${group}`}
                >
                  <h3
                    className="level-group-title"
                    id={`muscle-group-${group}`}
                  >
                    {categoryLabel(group)}
                  </h3>
                  {groupMuscles(group).map((muscle: Muscle) => (
                    <LevelRow
                      key={muscle}
                      name={muscleLabel(muscle)}
                      value={muscleChoice(data, muscle)}
                      onChange={(choice) =>
                        onChange(withMuscleChoice(data, muscle, choice))
                      }
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </Reveal>
      </div>
      <div className="plan-field">
        <span className="group-title" id="exercise-icon-title">
          {t("muscles.icon")}
        </span>
        <div
          className="icon-choices"
          role="group"
          aria-labelledby="exercise-icon-title"
        >
          {CUSTOM_ICONS.map((kind) => (
            <button
              key={kind}
              type="button"
              className="icon-choice"
              aria-pressed={icon === kind}
              onClick={() => onChange({ ...data, icon: kind })}
            >
              <span
                className="icon-choice-tile"
                data-tone={tone}
                aria-hidden="true"
              >
                {kind === "body" ? (
                  <MuscleIcon muscles={muscles} cardio={cardio} size={36} />
                ) : (
                  <EquipmentIcon kind={kind} size={24} />
                )}
              </span>
              <span className="icon-choice-label">{iconLabel(kind)}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
