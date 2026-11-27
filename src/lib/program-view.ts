// What Upptäck says about a standard programme (v6 §E6, E6b): its chips,
// avatar, row line, sheet subline and weekly hard sets. Pure, so it is
// tested (tests/program-sheet.test.ts).
import { catalogueById } from "../data/catalogue";
import type { MusclesOf } from "../data/exercise-muscles";
import {
  PROGRAM_CATEGORIES,
  programMuscleRows,
  programRange,
  type Program,
  type ProgramCategory,
} from "../data/programs";
import { formatDecimal, t } from "../i18n";
import { countLabel } from "./labels";

export type ProgramChip = "all" | ProgramCategory;
export const PROGRAM_CHIPS: readonly ProgramChip[] = [
  "all",
  ...PROGRAM_CATEGORIES,
];

/** The programmes a chip shows. */
export const programsFor = (programs: readonly Program[], chip: ProgramChip) =>
  programs.filter((p) => chip === "all" || p.category === chip);

/** The programme's leading exercise, for its avatar: the first of its first routine. */
export function programLead(program: Program) {
  const exerciseId = program.routines[0]?.exercises[0]?.exerciseId ?? "";
  return { exerciseId, category: catalogueById.get(exerciseId)?.category };
}

/** "Van · 4 dagar · 4 rutiner". */
export const programMeta = (program: Program) =>
  t("discover.programMeta", {
    level: t(program.level),
    days: countLabel(program.days, "day"),
    routines: countLabel(program.routines.length, "routine"),
  });

/** "Van · 4 dagar: mån, tis, tor, fre · ~60 min". */
export const programSub = (program: Program) =>
  t("discover.programSub", {
    level: t(program.level),
    days: t(program.daysText),
    minutes: program.minutes,
  });

/** A set count as written: "6,5", "2,25", "12". */
export const setsText = (sets: number) =>
  formatDecimal(Math.round(sets * 100) / 100);

/** "6,5–17,5 · riktmärke 10–20". */
export function programRangeText(program: Program, musclesOf: MusclesOf) {
  const [min, max] = programRange(program, musclesOf);
  return t("discover.programRange", {
    min: setsText(min),
    max: setsText(max),
  });
}

export { programMuscleRows };
