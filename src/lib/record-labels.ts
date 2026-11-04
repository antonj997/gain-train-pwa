import type { RecordKind } from "../data/exercise-records";
import { t, type MessageKey } from "../i18n";

const KIND_LABEL: Record<Exclude<RecordKind, "sessionVolume">, MessageKey> = {
  e1rm: "records.e1rm",
  heaviest: "records.heaviest",
  reps: "records.mostReps",
  setVolume: "records.setVolume",
};

/** "Record: Best est. 1RM, Heaviest weight". */
export function recordKindsLabel(kinds: readonly RecordKind[]) {
  return t("records.prLabel", {
    kinds: kinds
      .map((kind) =>
        kind === "sessionVolume"
          ? t("records.sessionVolume")
          : t(KIND_LABEL[kind]),
      )
      .join(", "),
  });
}
