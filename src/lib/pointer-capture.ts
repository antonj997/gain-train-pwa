// setPointerCapture throws when the pointer is already gone (a quick tap that
// ended, a cancelled touch on iOS). Capture only makes a drag smoother, so a
// failure must never break the handler that asked for it.

type Capturing = Pick<
  Element,
  "setPointerCapture" | "releasePointerCapture" | "hasPointerCapture"
>;

export function capturePointer(
  element: Capturing | null | undefined,
  id: number,
) {
  try {
    element?.setPointerCapture(id);
  } catch {
    /* The pointer already ended; the gesture works without capture. */
  }
}

export function releasePointer(
  element: Capturing | null | undefined,
  id: number,
) {
  try {
    if (element?.hasPointerCapture(id)) element.releasePointerCapture(id);
  } catch {
    /* Nothing was captured. */
  }
}
