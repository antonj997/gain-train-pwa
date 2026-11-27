import { useState } from "react";
import { Info } from "lucide-react";
import MuscleMap from "@/components/muscles/MuscleMap";
import Reveal from "@/components/motion/Reveal";
import Segmented from "@/components/ui/Segmented";
import { customMuscles, groupMuscles } from "@/data/exercise-muscles";
import type { CustomExercise } from "@/data/model";
import type { Muscle } from "@/data/muscles";
import type { MuscleGroup } from "@/data/muscle-sets";
import { useMapFigure } from "@/hooks/useMapFigure";
import { categoryLabel, muscleLabel } from "@/lib/catalogue-labels";
import { derivedCategories } from "@/lib/custom-exercise";
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
        neutral="none"
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

/**
 * The line under Muskler (v6 §D6): "Visas under **Bål** · även Säte", or,
 * before anything is chosen, how the group is picked.
 */
function DerivedLine({ data }: { data: CustomExercise }) {
  const { category, categories } = derivedCategories(customMuscles(data));
  return (
    <p className="editor-derived" role="status">
      <Info size={16} aria-hidden="true" />
      <span>
        {category === "Other"
          ? t("editor.derivedNone")
          : withBold(
              t("editor.derivedMain", { group: "\u0000" }),
              categoryLabel(category),
            )}
        {category !== "Other" &&
          categories.length > 0 &&
          t("editor.derivedAlso", {
            groups: categories.map(categoryLabel).join(", "),
          })}
      </span>
    </p>
  );
}

/** A message with one part in bold. */
function withBold(text: string, bold: string) {
  const [before, after = ""] = text.split("\u0000");
  return (
    <>
      {before}
      <b>{bold}</b>
      {after}
    </>
  );
}

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
  const { muscles } = pickerMuscles(data);
  const { fills, rank } = exerciseMapFills(muscles);
  return (
    <>
      <div className="plan-field muscle-picker">
        <span className="group-title" id="exercise-muscles-title">
          {t("muscles.title")}
        </span>
        <div className="muscle-map muscle-map-preview">
          <MuscleMap fills={fills} rank={rank} figure={figure} />
        </div>
        <DerivedLine data={data} />
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
    </>
  );
}
