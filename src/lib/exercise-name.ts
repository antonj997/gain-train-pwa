import { SV_NAMES } from "../data/exercise-names-sv";
import { getLanguage, t, type Language } from "../i18n";
import { categoryLabel, equipmentLabel } from "./catalogue-labels";

/**
 * An exercise's name as shown (v6 §D2): in Swedish, a built-in exercise's
 * Swedish name where it has one; otherwise the stored name. Records keep the
 * stored (English) name, and your own exercises always show as typed.
 */
export function exerciseDisplayName(
  exerciseId: string,
  storedName: string,
  language: Language = getLanguage(),
): string {
  if (language !== "sv") return storedName;
  return Object.prototype.hasOwnProperty.call(SV_NAMES, exerciseId)
    ? SV_NAMES[exerciseId]
    : storedName;
}

/** The Swedish name of a built-in exercise, if it has one (search matches it). */
export const swedishName = (exerciseId: string): string | undefined =>
  Object.prototype.hasOwnProperty.call(SV_NAMES, exerciseId)
    ? SV_NAMES[exerciseId]
    : undefined;

/**
 * The muted line under an exercise's name, wherever a row has one:
 *
 * - a built-in exercise: its equipment and English name, "skivstång · Bench
 *   Press" (in English the name is already English, so the equipment alone);
 * - your own exercise: its equipment, category and "own", "kabel · Bål ·
 *   egen" (the equipment left out when it has none).
 */
export function exerciseSubtitle(entry: {
  id: string;
  equipment?: string | null;
  category: string;
  custom: boolean;
  /** The stored (English) name. */
  englishName: string;
}): string {
  const parts: string[] = [];
  if (entry.equipment) parts.push(equipmentLabel(entry.equipment));
  if (entry.custom) {
    parts.push(categoryLabel(entry.category), t("exercise.own"));
  } else if (
    exerciseDisplayName(entry.id, entry.englishName) !== entry.englishName
  ) {
    parts.push(entry.englishName);
  }
  return parts.join(" · ");
}
