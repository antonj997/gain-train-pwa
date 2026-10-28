import { isDrop } from "@/data/drops";
import { labelSet, type WorkoutSet } from "@/data/model";

/**
 * A finished exercise's checked sets. A drop continues the set above it, so it
 * has no number of its own and does not shift the numbers of the sets below.
 */
export default function HistorySetList({ sets }: { sets: WorkoutSet[] }) {
  const done = sets.filter((s) => s.done);
  return (
    <>
      {done.map((s, i) =>
        isDrop(s) ? (
          <div className="history-set" key={s.id}>
            <strong>{"↳ " + labelSet(s)}</strong>
          </div>
        ) : (
          <div className="history-set" key={s.id}>
            <span>
              Set {done.slice(0, i + 1).filter((x) => !isDrop(x)).length}
              {s.section !== "working"
                ? " · " + (s.section === "warmup" ? "Warm-up" : "Cool-down")
                : ""}
            </span>
            <strong>{labelSet(s)}</strong>
          </div>
        ),
      )}
    </>
  );
}
