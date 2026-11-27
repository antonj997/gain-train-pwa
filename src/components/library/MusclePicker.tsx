import { useCallback, useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import MuscleMap from "@/components/muscles/MuscleMap";
import Segmented from "@/components/ui/Segmented";
import { customMuscles, groupMuscles } from "@/data/exercise-muscles";
import type { CustomExercise } from "@/data/model";
import { MUSCLE_GROUP, type Muscle } from "@/data/muscles";
import type { MuscleGroup } from "@/data/muscle-sets";
import { useMapFigure } from "@/hooks/useMapFigure";
import { categoryLabel, muscleLabel } from "@/lib/catalogue-labels";
import { derivedCategories } from "@/lib/custom-exercise";
import { exerciseMapFills } from "@/lib/muscle-figure";
import {
  LEVEL_CHOICES,
  MUSCLE_LATIN,
  cycleChoice,
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
type Side = "front" | "back";

/** One row: a name (a Latin subtitle, or "Blandat" when its muscles differ) and Ingen / Lite / Mycket. */
function LevelRow({
  name,
  sub,
  value,
  onChange,
}: {
  name: string;
  sub?: string;
  value: LevelChoice | "mixed";
  onChange: (choice: LevelChoice) => void;
}) {
  return (
    <div className="level-row">
      <span className="level-row-name">
        {name}
        {value === "mixed" ? (
          <span className="level-row-mixed">{t("muscles.mixed")}</span>
        ) : (
          sub && <span className="level-row-sub">{sub}</span>
        )}
      </span>
      <Segmented<LevelChoice | "mixed">
        label={name}
        value={value}
        neutral="none"
        options={LEVEL_CHOICES.map((choice) => ({
          value: choice,
          label: t(`muscles.level.${choice}`),
        }))}
        onChange={(choice) => choice !== "mixed" && onChange(choice)}
      />
    </div>
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

/**
 * Keeps the map column at the top of the sheet's scroll, under its sticky
 * title, and says when it is stuck there (the hairline under it shows).
 */
function useStickyColumn() {
  const column = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = column.current;
    const scroller = el?.closest<HTMLElement>(".dialog-content");
    if (!el || !scroller) return;
    const header = scroller.querySelector<HTMLElement>(".dialog-header");
    let frame = 0;
    const update = () => {
      frame = 0;
      const box = scroller.getBoundingClientRect();
      const top = header ? header.getBoundingClientRect().bottom : box.top;
      el.style.setProperty("--picker-top", `${Math.round(top - box.top)}px`);
      const parent = el.parentElement?.getBoundingClientRect();
      setStuck(!!parent && parent.top < el.getBoundingClientRect().top - 0.5);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);
  return { column, stuck };
}

/**
 * The custom-exercise editor's Muscles section (v6 §E3, E4): Enkel |
 * Avancerad and the category line, then two columns. Left, the map: one
 * side at a time at 138 × 327 px with Fram | Bak to flip it (a cross-fade),
 * sticky at the top while the list scrolls; a tap on a muscle cycles Ingen →
 * Mycket → Lite for that muscle (Avancerad) or its group (Enkel). Right, the
 * levels: the seven groups, or each muscle with its Latin name, each with
 * Ingen | Lite | Mycket ("Ingen" neutral). Until something is changed the
 * picker shows the muscles of the exercise's categories.
 */
export default function MusclePicker({
  data,
  onChange,
  defaultMode = "simple",
}: {
  data: CustomExercise;
  onChange: (data: CustomExercise) => void;
  /** Enkel or Avancerad when it opens. */
  defaultMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [side, setSide] = useState<Side>("front");
  const [figure] = useMapFigure();
  const { muscles } = pickerMuscles(data);
  const { fills, rank } = exerciseMapFills(muscles);
  const { column, stuck } = useStickyColumn();
  // The map's shortcut reads the latest draft, so it can stay one function.
  const latest = useRef({ data, mode, onChange });
  latest.current = { data, mode, onChange };
  const pick = useCallback((shape: readonly Muscle[]) => {
    const { data, mode, onChange } = latest.current;
    const muscle = shape[0];
    if (!muscle) return;
    if (mode === "advanced")
      onChange(
        withMuscleChoice(data, muscle, cycleChoice(muscleChoice(data, muscle))),
      );
    else {
      const group = MUSCLE_GROUP[muscle];
      onChange(
        withGroupChoice(data, group, cycleChoice(groupChoice(data, group))),
      );
    }
  }, []);
  return (
    <div className="plan-field muscle-picker">
      <div className="muscle-picker-head">
        <span className="group-title" id="exercise-muscles-title">
          {t("muscles.title")}
        </span>
        <Segmented<Mode>
          label={t("muscles.title")}
          value={mode}
          options={[
            { value: "simple", label: t("muscles.simple") },
            { value: "advanced", label: t("muscles.advanced") },
          ]}
          onChange={setMode}
        />
      </div>
      <DerivedLine data={data} />
      <div className="muscle-picker-grid">
        <div
          ref={column}
          className={"muscle-picker-map is-sticky" + (stuck ? " is-stuck" : "")}
        >
          <div className="muscle-map muscle-map-preview muscle-map-side">
            {(["front", "back"] as const).map((s) => (
              <div
                key={s}
                className={"muscle-map-face" + (side === s ? " is-shown" : "")}
                aria-hidden="true"
              >
                <MuscleMap
                  fills={fills}
                  rank={rank}
                  figure={figure}
                  side={s}
                  onPick={pick}
                />
              </div>
            ))}
          </div>
          <Segmented<Side>
            label={t("muscles.sideLabel")}
            value={side}
            options={[
              { value: "front", label: t("muscles.front") },
              { value: "back", label: t("muscles.back") },
            ]}
            onChange={setSide}
          />
          <p className="muscle-picker-hint">{t("muscles.tapHint")}</p>
        </div>
        <div className="muscle-picker-levels">
          {mode === "simple" ? (
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
          ) : (
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
                      sub={MUSCLE_LATIN[muscle]}
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
        </div>
      </div>
    </div>
  );
}
