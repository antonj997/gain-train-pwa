import type { useRestTimer } from "@/hooks/useRestTimer";
import { useT } from "@/i18n/useT";

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** The floating rest bar: time left while resting, "Rest done" after. */
export default function RestBar({
  rest,
}: {
  rest: ReturnType<typeof useRestTimer>;
}) {
  const { t } = useT();
  if (!(rest.remaining > 0 || rest.elapsed)) return null;
  return (
    <div className="rest-bar">
      {rest.elapsed ? (
        <>
          <span className="rest-bar-time" role="status">
            {t("workout.restDone")}
          </span>
          <button type="button" className="btn-quiet" onClick={rest.skip}>
            {t("workout.dismiss")}
          </button>
        </>
      ) : (
        <>
          <span
            className="rest-bar-time"
            role="timer"
            aria-label={t("workout.restRemaining")}
          >
            {clock(rest.remaining)}
          </span>
          <button type="button" className="btn-quiet" onClick={rest.extend}>
            {t("workout.plus30")}
          </button>
          <button type="button" className="btn-quiet" onClick={rest.skip}>
            {t("workout.skip")}
          </button>
        </>
      )}
    </div>
  );
}
