import { useEffect, useState } from "react";
import { registerTipTarget } from "@/lib/tip-store";
import type { TipId } from "@/lib/tips";

/**
 * Points a one-time tip at an element: pass the returned callback as its
 * `ref`. With no id (or a tip already seen) it does nothing.
 */
export function useTipTarget<T extends HTMLElement = HTMLElement>(
  id: TipId | null | undefined | false,
) {
  const [element, setElement] = useState<T | null>(null);
  useEffect(() => {
    if (!id || !element) return;
    return registerTipTarget(id, element);
  }, [id, element]);
  return setElement;
}
