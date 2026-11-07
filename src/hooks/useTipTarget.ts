import { useEffect, useState } from "react";
import { registerTipTarget, tipUsed } from "@/lib/tip-store";
import type { TipId } from "@/lib/tips";

/**
 * Points a one-time tip at an element: pass the returned callback as its
 * `ref`. With `tap`, tapping the element counts as using it and the tip goes
 * for good (a swipe or hold marks its own tip used). With no id it does
 * nothing.
 */
export function useTipTarget<T extends HTMLElement = HTMLElement>(
  id: TipId | null | undefined | false,
  { tap = false }: { tap?: boolean } = {},
) {
  const [element, setElement] = useState<T | null>(null);
  useEffect(() => {
    if (!id || !element) return;
    const forget = registerTipTarget(id, element);
    if (!tap) return forget;
    const used = () => tipUsed(id);
    element.addEventListener("click", used);
    return () => {
      element.removeEventListener("click", used);
      forget();
    };
  }, [id, element, tap]);
  return setElement;
}
