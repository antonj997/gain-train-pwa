import { createContext } from "react";
import type { PadField } from "@/lib/number-pad";

/**
 * The live workout's number pad, for the set rows (NumberPad.tsx). Absent
 * elsewhere (a routine's sets, editing a finished workout), where the fields
 * keep the phone's own keyboard. The value never changes, so rows that read
 * it do not re-render when the pad moves.
 */
export type NumberPadApi = {
  /** Opens the pad on a set's field, or moves it there. */
  open: (setId: string, field: PadField) => void;
  /**
   * A touch screen: the pad replaces the phone's keyboard (inputmode none).
   * With a mouse and keyboard the fields still take typing.
   */
  coarse: boolean;
};

export const NumberPadContext = createContext<NumberPadApi | null>(null);
