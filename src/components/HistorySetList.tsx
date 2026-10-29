import { isDrop } from "@/data/drops";
import { labelSet, type WorkoutSet } from "@/data/model";
import { t } from "@/i18n";

/**
 * A finished exercise's checked sets, numbered like the workout screen: only
 * working sets get a number. A drop continues the set above it, so it has no
 * number of its own and does not shift the numbers of the sets below.
 */
export default function HistorySetList({ sets }: { sets: WorkoutSet[] }) {
  const done = sets.filter((s) => s.done);
  return (
    <>
      {done.map((s, i) =>
        isDrop(s) ? (
          <div className="history-set history-drop" key={s.id}>
            <strong>{"↳ " + labelSet(s)}</strong>
          </div>
        ) : (
          <div className="history-set" key={s.id}>
            <span>
              {s.section === "warmup"
                ? t("history.warmup")
                : s.section === "winddown"
                  ? t("history.cooldown")
                  : t("history.setN", {
                      n: done
                        .slice(0, i + 1)
                        .filter((x) => !isDrop(x) && x.section === "working")
                        .length,
                    })}
            </span>
            <strong>{labelSet(s)}</strong>
          </div>
        ),
      )}
    </>
  );
}
