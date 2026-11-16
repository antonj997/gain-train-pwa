import type { StrengthStatus } from "@/data/lift-goal";
import type { MessageKey } from "@/i18n";

/** A lift goal's smoothed strength as a chip: Going up, Steady, Going down or Too little data. */
export const statusChip: Record<
  StrengthStatus,
  { key: MessageKey; tone: string }
> = {
  up: { key: "goals.statusUp", tone: " done" },
  flat: { key: "goals.statusFlat", tone: " muted" },
  down: { key: "goals.statusDown", tone: " warm" },
  insufficient: { key: "goals.statusInsufficient", tone: " muted" },
};
