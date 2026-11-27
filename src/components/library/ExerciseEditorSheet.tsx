import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import Reveal from "@/components/motion/Reveal";
import MusclePicker from "@/components/library/MusclePicker";
import EquipmentIcon from "@/components/muscles/EquipmentIcon";
import MuscleIcon from "@/components/muscles/MuscleIcon";
import {
  customIconOf,
  customMuscles,
  isCardioExercise,
} from "@/data/exercise-muscles";
import type { CustomExercise } from "@/data/model";
import {
  CUSTOM_EQUIPMENT,
  catalogueTwin,
  derivedCategories,
  equipmentOf,
  withCatalogueMuscles,
  withDerivedCategory,
  withEquipment,
} from "@/lib/custom-exercise";
import { sameNamedExercise } from "@/lib/exercise-search";
import { exerciseDisplayName } from "@/lib/exercise-name";
import { categoryTone } from "@/lib/exercise-icon";
import { equipmentLabel } from "@/lib/catalogue-labels";
import { notify } from "@/lib/message-store";
import { exercisePath } from "@/lib/routes";
import { t } from "@/i18n";

export type ExerciseDraft = { id: string; data: CustomExercise };

/** "Hantel": an equipment name as a chip label. */
const capital = (text: string) =>
  text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** A message with one part in bold: "Det finns redan **Pallofpress** i biblioteket." */
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
 * Your own exercise (v6 §E3): the icon preview beside the name (focused when
 * new), a row under it when the name is a catalogue exercise ("Öppna den",
 * "Använd dess muskler"), the equipment as one sideways chip row, the
 * muscles (which also give the category), a note and "Spara övning". Kept
 * as a draft until saved; ✕ closes and keeps it.
 */
export default function ExerciseEditorSheet({
  open,
  draft,
  retained,
  saved,
  busy,
  error,
  onChange,
  onSave,
  onDelete,
  onClose,
  onDiscard,
  exercises = [],
}: {
  open: boolean;
  draft: ExerciseDraft | null;
  /** False when storage refused the draft. */
  retained: boolean;
  /** The exercise exists already (editing rather than creating). */
  saved: boolean;
  busy: boolean;
  error: string;
  onChange: (draft: ExerciseDraft) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
  onDiscard: () => void;
  /** Every exercise, built-in and custom, to warn about a name in use. */
  exercises?: readonly { id: string; name: string }[];
}) {
  const navigate = useNavigate();
  const set = (change: Partial<CustomExercise>) =>
    draft && onChange({ ...draft, data: { ...draft.data, ...change } });
  const name = draft?.data.name ?? "";
  // A catalogue exercise of that name offers its page and its muscles;
  // another of your own only gets a warning, since lists can't tell them apart.
  const twin = useMemo(
    () => (draft ? catalogueTwin(name, exercises) : undefined),
    [draft, name, exercises],
  );
  const ownTwin =
    draft && !twin ? sameNamedExercise(name, exercises, draft.id) : undefined;
  const data = draft?.data;
  const equipment = data ? equipmentOf(data) : "dumbbell";
  const icon = data ? customIconOf(data) : "dumbbell";
  // A new exercise has nothing yet: the discard link waits for a change.
  const changed =
    !!data &&
    (saved ||
      !!data.name.trim() ||
      !!data.note.trim() ||
      data.muscles !== undefined);
  return (
    <Sheet
      size="full"
      open={open && !!draft}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={saved ? t("exercises.edit") : t("exercises.new")}
      // Only an edit can rename what finished workouts show.
      description={saved ? t("editor.description") : undefined}
    >
      {draft && data && (
        <>
          <label className="editor-name">
            {t("editor.name")}
            <span className="editor-name-row">
              <span
                className="ex-avatar"
                data-tone={categoryTone(
                  derivedCategories(customMuscles(data)).category,
                )}
                aria-hidden="true"
              >
                {icon === "body" ? (
                  <MuscleIcon
                    muscles={customMuscles(data)}
                    cardio={isCardioExercise(data)}
                    size={34}
                  />
                ) : (
                  <EquipmentIcon kind={icon} size={24} />
                )}
              </span>
              <input
                value={data.name}
                maxLength={100}
                placeholder={t("editor.namePlaceholder")}
                autoFocus={!saved}
                autoComplete="off"
                aria-describedby={
                  twin || ownTwin ? "exercise-name-twin" : undefined
                }
                onChange={(e) => set({ name: e.target.value })}
              />
            </span>
          </label>
          <Reveal>
            {twin ? (
              <div
                id="exercise-name-twin"
                className="editor-twin"
                role="status"
              >
                <p>
                  {withBold(
                    t("editor.catalogueTwin", { name: "\u0000" }),
                    exerciseDisplayName(twin.id, twin.name),
                  )}
                </p>
                <div className="editor-twin-links">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      onClose();
                      navigate(exercisePath(twin.id));
                    }}
                  >
                    {t("editor.openTwin")}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      onChange({
                        ...draft,
                        data: withCatalogueMuscles(data, twin.id),
                      });
                      notify.success(
                        t("editor.usedTwin", {
                          name: exerciseDisplayName(twin.id, twin.name),
                        }),
                      );
                    }}
                  >
                    {t("editor.useTwin")}
                  </button>
                </div>
              </div>
            ) : ownTwin ? (
              <p
                id="exercise-name-twin"
                className="field-warning"
                role="status"
              >
                {t("editor.twin", { name: ownTwin.name })}
              </p>
            ) : null}
          </Reveal>
          <div className="plan-field">
            <span className="group-title" id="exercise-equipment">
              {t("editor.equipment")}
            </span>
            <div
              className="facet-chips equipment-chips"
              role="group"
              aria-labelledby="exercise-equipment"
            >
              {CUSTOM_EQUIPMENT.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className="filter-chip equipment-chip"
                  aria-pressed={equipment === kind}
                  onClick={() =>
                    onChange({ ...draft, data: withEquipment(data, kind) })
                  }
                >
                  <EquipmentIcon kind={kind} size={20} />
                  {capital(equipmentLabel(kind))}
                </button>
              ))}
            </div>
            <p className="row-sub">{t("editor.equipmentNote")}</p>
          </div>
          <MusclePicker
            data={data}
            onChange={(next) =>
              onChange({ ...draft, data: withDerivedCategory(next) })
            }
          />
          <label>
            {t("editor.noteOptional")}
            <textarea
              value={data.note}
              maxLength={1000}
              placeholder={t("editor.notePlaceholder")}
              onChange={(e) => set({ note: e.target.value })}
            />
          </label>
          <Reveal>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
          </Reveal>
          {!retained && (
            <p className="field-error" role="alert">
              {t("editor.storageUnavailable")}
            </p>
          )}
          {saved && (
            <button
              type="button"
              className="btn-danger"
              disabled={busy}
              onClick={onDelete}
            >
              <Trash2 size={18} aria-hidden="true" />
              {t("exercises.delete")}
            </button>
          )}
          {changed && (
            <button
              type="button"
              className="text-button danger editor-discard"
              disabled={busy}
              onClick={onDiscard}
            >
              {t("routines.discardDraft")}
            </button>
          )}
          {/* Last, so it can stick to the bottom edge of the long form. */}
          <div className="sheet-footer">
            <button
              type="button"
              className="btn-primary btn-block"
              disabled={busy || !data.name.trim()}
              onClick={onSave}
            >
              {busy ? t("common.saving") : t("editor.save")}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
