import type { PrKind } from "../data/exercise-records";
import { t, type MessageKey } from "../i18n";

const KIND_LABEL: Record<PrKind, MessageKey> = {
  heaviest: "records.heaviest",
  setVolume: "records.setVolume",
};

/** The records a PR set, heaviest first: "Heaviest weight · Best set volume". */
export const prKindsText = (kinds: readonly PrKind[]) =>
  kinds.map((kind) => t(KIND_LABEL[kind])).join(" · ");

/** "Record: Heaviest weight · Best set volume". */
export function recordKindsLabel(kinds: readonly PrKind[]) {
  return t("records.prLabel", { kinds: prKindsText(kinds) });
}
