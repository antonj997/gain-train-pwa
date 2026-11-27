import { Check, Plus } from "lucide-react";
import RoutineGlyph from "@/components/library/RoutineGlyph";
import type { Program } from "@/data/programs";
import {
  PROGRAM_CHIPS,
  programLead,
  programMeta,
  programsFor,
  type ProgramChip,
} from "@/lib/program-view";
import { useT } from "@/i18n/useT";

/**
 * Upptäck's standard programmes (v6 §E6): the chips Alla, Helkropp,
 * Över/under, Tryck/drag/ben, Styrka and Hemma, the heading, a row per
 * programme (its avatar, title and "Van · 4 dagar · 4 rutiner", opening the
 * programme) with a round 44px + that adds its routines to Mina and reads ✓
 * once they are there (a second tap removes them), and the note on what the
 * programmes are built on.
 */
export default function ProgramList({
  programs,
  chip,
  onChip,
  isAdded,
  busy,
  onToggle,
  onOpen,
}: {
  programs: readonly Program[];
  chip: ProgramChip;
  onChip: (chip: ProgramChip) => void;
  isAdded: (program: Program) => boolean;
  /** A programme being added or removed: every + waits. */
  busy: boolean;
  onToggle: (program: Program) => void;
  onOpen: (program: Program) => void;
}) {
  const { t } = useT();
  const shown = programsFor(programs, chip);
  return (
    <section className="program-list" aria-labelledby="discover-programs">
      <div
        className="facet-chips"
        role="group"
        aria-label={t("discover.programKinds")}
      >
        {PROGRAM_CHIPS.map((value) => (
          <button
            key={value}
            type="button"
            className="filter-chip"
            aria-pressed={chip === value}
            onClick={() => onChip(value)}
          >
            {t(`discover.chip.${value}`)}
          </button>
        ))}
      </div>
      <h2 className="group-title" id="discover-programs">
        {t("discover.programs")}
      </h2>
      <div className="list">
        {shown.map((p) => {
          const added = isAdded(p);
          const lead = programLead(p);
          return (
            <div className="row program-row" key={p.id} data-program={p.id}>
              <button
                type="button"
                className="row-main row-open program-open"
                aria-label={t("discover.programOpen", { title: p.title })}
                onClick={() => onOpen(p)}
              >
                <RoutineGlyph
                  exerciseId={lead.exerciseId}
                  category={lead.category}
                  size={36}
                />
                <span className="program-text">
                  <span className="row-title">{p.title}</span>
                  <span className="row-sub">{programMeta(p)}</span>
                </span>
              </button>
              <button
                type="button"
                className={"program-add" + (added ? " is-added" : "")}
                aria-pressed={added}
                aria-label={t("discover.programAdd", { title: p.title })}
                disabled={busy}
                onClick={() => onToggle(p)}
              >
                {added ? (
                  <Check size={20} aria-hidden="true" />
                ) : (
                  <Plus size={20} aria-hidden="true" />
                )}
              </button>
            </div>
          );
        })}
      </div>
      <p className="program-note">{t("discover.programNote")}</p>
    </section>
  );
}
