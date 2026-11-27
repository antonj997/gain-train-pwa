import { useRef } from "react";
import { CalendarDays, Plus } from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import RoutineGlyph from "@/components/library/RoutineGlyph";
import { catalogueById } from "@/data/catalogue";
import type { MusclesOf } from "@/data/exercise-muscles";
import type { Program } from "@/data/programs";
import { muscleLabel } from "@/lib/catalogue-labels";
import { exerciseDisplayName } from "@/lib/exercise-name";
import {
  programMuscleRows,
  programRangeText,
  programSub,
  setsText,
} from "@/lib/program-view";
import { useT } from "@/i18n/useT";

/**
 * A programme's content (v6 §E6b): why it looks as it does, a card with the
 * hard sets each main muscle gets in a week (lowest first, the volume card's
 * model) and every routine with its exercises as "{sets} × {range}".
 */
export function ProgramSheetBody({
  program,
  musclesOf,
}: {
  program: Program;
  musclesOf: MusclesOf;
}) {
  const { t } = useT();
  return (
    <div className="program-sheet-body">
      <p className="program-why">{t(program.why)}</p>
      <section className="card program-sets" aria-labelledby="program-sets">
        <h3 className="program-sets-title" id="program-sets">
          {t("discover.programSets")}
        </h3>
        <p className="row-sub">{programRangeText(program, musclesOf)}</p>
        <dl className="program-sets-list">
          {programMuscleRows(program, musclesOf).map(({ muscle, sets }) => (
            <div className="program-sets-row" key={muscle}>
              <dt>{muscleLabel(muscle)}</dt>
              <dd>{setsText(sets)}</dd>
            </div>
          ))}
        </dl>
      </section>
      {program.routines.map((routine) => (
        <section
          key={routine.name}
          className="program-routine"
          aria-label={routine.name}
        >
          <h3 className="group-title">{routine.name}</h3>
          <div className="list">
            {routine.exercises.map((e, index) => {
              const builtin = catalogueById.get(e.exerciseId);
              return (
                <div className="row program-exercise" key={index}>
                  <RoutineGlyph
                    exerciseId={e.exerciseId}
                    category={builtin?.category}
                    size={36}
                  />
                  <span className="row-main">
                    <span className="row-title">
                      {exerciseDisplayName(
                        e.exerciseId,
                        builtin?.name ?? e.exerciseId,
                      )}
                    </span>
                  </span>
                  <span className="program-exercise-sets">
                    {t("discover.programLine", {
                      sets: e.sets,
                      min: e.repRange.min,
                      max: e.repRange.max,
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * A standard programme in a full-height sheet: its level, days and length
 * over the title, the content (ProgramSheetBody), and at the foot "Lägg till
 * {n} rutiner" (or "Ta bort från Mina" once added) and "Gör det till ett
 * schema", which opens Nytt schema with the programme's weeks.
 */
export default function ProgramSheet({
  program,
  musclesOf,
  added,
  busy,
  onClose,
  onToggle,
  onMakePlan,
}: {
  program: Program | null;
  musclesOf: MusclesOf;
  added: boolean;
  busy: boolean;
  onClose: () => void;
  onToggle: (program: Program) => void;
  onMakePlan: (program: Program) => void;
}) {
  const { t } = useT();
  // The sheet keeps its content while it slides out.
  const shown = useRef(program);
  if (program) shown.current = program;
  const p = shown.current;
  return (
    <Sheet
      size="full"
      open={!!program}
      onClose={onClose}
      title={p?.title ?? ""}
      description={p ? programSub(p) : undefined}
    >
      {p && (
        <>
          <ProgramSheetBody program={p} musclesOf={musclesOf} />
          <div className="sheet-footer program-sheet-foot">
            <button
              type="button"
              className={
                added ? "btn-secondary btn-block" : "btn-primary btn-block"
              }
              disabled={busy}
              onClick={() => onToggle(p)}
            >
              {!added && <Plus size={18} aria-hidden="true" />}
              {added
                ? t("discover.programRemoveAll")
                : t("discover.programAddAll", { count: p.routines.length })}
            </button>
            <button
              type="button"
              className="btn-secondary btn-block"
              disabled={busy}
              onClick={() => onMakePlan(p)}
            >
              <CalendarDays size={18} aria-hidden="true" />
              {t("discover.programMakePlan")}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
