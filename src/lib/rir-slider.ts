/**
 * The number pad's RIR mode (v6 B12): a slider from 0 (max) to 5+ (easy)
 * that steps at each whole number. Pure, so it is tested
 * (tests/rir-slider.test.ts); the slider is components/workout/RirSlider.tsx.
 */
import type { MessageKey } from "../i18n";
import { RIR_TOP, type Rir } from "./rir";

const clamp = (value: number): Rir =>
  Math.min(RIR_TOP, Math.max(0, Math.round(value))) as Rir;

/** The RIR at `x` px along a track `width` px wide. */
export function rirFromPosition(x: number, width: number): Rir {
  if (!(width > 0)) return 0;
  return clamp((x / width) * RIR_TOP);
}

/** The middle of the scale: where an unset slider's first arrow lands. */
const START: Rir = 2;

/**
 * The value after a key on the slider: the arrows step one (right and up
 * are more), Home is 0 and End 5+. An unset slider's first arrow gives 2.
 * Any other key leaves the value as it is.
 */
export function rirKey(value: Rir | null, key: string): Rir | null {
  if (key === "Home") return 0;
  if (key === "End") return RIR_TOP as Rir;
  const step =
    key === "ArrowRight" || key === "ArrowUp"
      ? 1
      : key === "ArrowLeft" || key === "ArrowDown"
        ? -1
        : 0;
  if (!step) return value;
  if (value === null) return START;
  return clamp(value + step);
}

/** The line under the slider, by value (aria-live). */
export const RIR_TEXT: Record<Rir | "unset", MessageKey> = {
  unset: "pad.rirHelpUnset",
  0: "pad.rirHelp0",
  1: "pad.rirHelp1",
  2: "pad.rirHelp2",
  3: "pad.rirHelp3",
  4: "pad.rirHelp4",
  5: "pad.rirHelp5",
};

/** The slider's aria-valuetext, by value. */
export const RIR_VALUE_TEXT: Record<Rir | "unset", MessageKey> = {
  unset: "pad.rirValueUnset",
  0: "pad.rirValue0",
  1: "pad.rirValue1",
  2: "pad.rirValue2",
  3: "pad.rirValue3",
  4: "pad.rirValue4",
  5: "pad.rirValue5",
};
