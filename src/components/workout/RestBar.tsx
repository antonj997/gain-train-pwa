import type { useRestTimer } from "@/hooks/useRestTimer";

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** The floating rest bar: time left while resting, "Rest done" after. */
export default function RestBar({
  rest,
}: {
  rest: ReturnType<typeof useRestTimer>;
}) {
  if (!(rest.remaining > 0 || rest.elapsed)) return null;
  return (
    <div className="rest-bar">
      {rest.elapsed ? (
        <>
          <span className="rest-bar-time" role="status">
            Rest done
          </span>
          <button type="button" className="btn-quiet" onClick={rest.skip}>
            Dismiss
          </button>
        </>
      ) : (
        <>
          <span
            className="rest-bar-time"
            role="timer"
            aria-label="Rest time remaining"
          >
            {clock(rest.remaining)}
          </span>
          <button type="button" className="btn-quiet" onClick={rest.extend}>
            +30 s
          </button>
          <button type="button" className="btn-quiet" onClick={rest.skip}>
            Skip
          </button>
        </>
      )}
    </div>
  );
}
