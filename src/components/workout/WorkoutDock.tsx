import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Workout, WorkoutSet } from "@/data/model";
import type { LastSession } from "@/data/workouts";
import type { PadTarget } from "@/lib/number-pad";
import type { WeightUnit } from "@/lib/units";
import type { FillSource } from "@/lib/set-target";
import { EASE, MOTION, play, settled } from "@/lib/motion";
import { useKeepAboveSheet } from "@/hooks/useKeepAboveSheet";
import NumberPad from "@/components/workout/NumberPad";
import RestDock from "@/components/workout/RestDock";

const reduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The foot of a live workout: the rest dock, with the number pad under it
 * while a field is typed. It is fixed to the bottom and publishes its height
 * as --dock-space, so the page leaves room for it and nothing is ever under
 * it; while the pad is open the row being typed stays centred above it
 * (useKeepAboveSheet). The pad slides in with the dock riding on top of it
 * (340 ms on the sheet curve) and out the same way (240 ms).
 */
export default function WorkoutDock({
  rest,
  pad,
}: {
  rest: ComponentProps<typeof RestDock>;
  pad: {
    target: PadTarget | null;
    setTarget: Dispatch<SetStateAction<PadTarget | null>>;
    workout: Workout;
    previous: Map<string, LastSession>;
    unit: WeightUnit;
    changeSet: (setId: string, change: (set: WorkoutSet) => WorkoutSet) => void;
    targets?: ReadonlyMap<string, { text: string; source: FillSource }>;
  };
}) {
  const root = useRef<HTMLDivElement>(null);
  const padEl = useRef<HTMLDivElement>(null);
  const dropFrom = useRef(0);
  // The pad stays while it slides out, with the field it last typed.
  const [shown, setShown] = useState<PadTarget | null>(pad.target);
  if (pad.target && pad.target !== shown) setShown(pad.target);
  const closing = useRef<Animation | null>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const publish = () =>
      document.documentElement.style.setProperty(
        "--dock-space",
        `${el.offsetHeight}px`,
      );
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--dock-space");
    };
  }, []);

  useKeepAboveSheet(pad.target?.setId ?? null, root);

  const open = !!pad.target;
  const wasOpen = useRef(false);
  useLayoutEffect(() => {
    const was = wasOpen.current;
    wasOpen.current = open;
    const el = root.current;
    const height = padEl.current?.offsetHeight ?? 0;
    if (open && !was) {
      closing.current?.cancel();
      closing.current = null;
      if (reduced()) play(padEl.current, [{ opacity: 0 }, { opacity: 1 }]);
      else
        play(
          el,
          [{ transform: `translateY(${height}px)` }, { transform: "none" }],
          { duration: MOTION.sheetIn, easing: EASE.sheet },
        );
    } else if (!open && was) {
      const from = dropFrom.current;
      dropFrom.current = 0;
      const out = reduced()
        ? play(padEl.current, [{ opacity: 1 }, { opacity: 0 }], {
            fill: "forwards",
          })
        : play(
            el,
            [
              { transform: `translateY(${from}px)` },
              { transform: `translateY(${height}px)` },
            ],
            { duration: MOTION.sheetOut, easing: EASE.in, fill: "forwards" },
          );
      closing.current = out;
      void settled(out).then(() => {
        if (closing.current !== out) return;
        setShown(null);
      });
    }
  }, [open]);
  // Gone: the dock drops back to the foot without a jump.
  useLayoutEffect(() => {
    if (shown) return;
    closing.current?.cancel();
    closing.current = null;
  }, [shown]);

  return (
    <div ref={root} className="workout-dock">
      <RestDock {...rest} />
      {shown && (
        <div ref={padEl} className="workout-dock-pad">
          <NumberPad
            {...pad}
            target={shown}
            container={root}
            dropFrom={dropFrom}
          />
        </div>
      )}
    </div>
  );
}
