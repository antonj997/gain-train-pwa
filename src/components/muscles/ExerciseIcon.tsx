import { memo, useContext, useMemo } from "react";
import { DataContext } from "@/contexts/useData";
import type { RecordDoc } from "@/data/model";
import { exerciseIcon } from "@/lib/exercise-icon";
import EquipmentIcon from "./EquipmentIcon";
import MuscleIcon from "./MuscleIcon";

const NO_RECORDS: Record<string, RecordDoc> = {};

type Props = {
  /** A catalogue id ("builtin:squat"), a custom exercise's id or "shared:…". */
  exerciseId: string;
  /** Its main category, for an id this version doesn't know. */
  category?: string;
  /** The equipment glyph's size. */
  glyph: number;
  /** The muscle figure's size: larger, since the figure is narrow. */
  body: number;
};

/**
 * An exercise's icon (see exerciseIcon): its muscle figure, the heart figure
 * for cardio, or your own exercise's equipment glyph. Drawn in the current
 * text colour; inside a tinted avatar or badge the --mi-* mixes in
 * muscles.css colour the figure. Decorative: the name is always beside it.
 */
function ExerciseIcon({ exerciseId, category, glyph, body }: Props) {
  const records = useContext(DataContext)?.state.records ?? NO_RECORDS;
  const icon = useMemo(
    () => exerciseIcon(records, exerciseId, category),
    [records, exerciseId, category],
  );
  return icon.kind === "equipment" ? (
    <EquipmentIcon kind={icon.equipment} size={glyph} />
  ) : (
    <MuscleIcon muscles={icon.muscles} cardio={icon.cardio} size={body} />
  );
}

export default memo(ExerciseIcon);
