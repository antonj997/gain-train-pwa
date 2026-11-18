import { useSyncExternalStore } from "react";
import {
  MAP_FIGURE_EVENT,
  readMapFigure,
  saveMapFigure,
} from "@/lib/preferences";

const subscribe = (listener: () => void) => {
  window.addEventListener(MAP_FIGURE_EVENT, listener);
  // Another tab of the app changed it.
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(MAP_FIGURE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
};

/** The muscle maps' figure on this device (Settings → Muscle map), and a setter. */
export function useMapFigure() {
  const figure = useSyncExternalStore(
    subscribe,
    readMapFigure,
    () => "m" as const,
  );
  return [figure, saveMapFigure] as const;
}
