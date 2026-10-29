import type { SharedStatus } from "@/hooks/useSharedExercises";
import type { LibraryExercise } from "@/lib/library";

/** Library → Exercises → Shared: what other people shared, each with Add. */
export default function SharedExerciseList({
  canShare,
  ready,
  status,
  hasRows,
  items,
  narrowed,
  adding,
  onRetry,
  onAdd,
}: {
  canShare: boolean;
  /** Signed in and online. */
  ready: boolean;
  status: SharedStatus;
  /** Rows were fetched before, so a failed refresh still shows them. */
  hasRows: boolean;
  items: LibraryExercise[];
  /** A search or a facet narrows the list. */
  narrowed: boolean;
  /** The id being added, or "". */
  adding: string;
  onRetry: () => void;
  onAdd: (id: string) => void;
}) {
  if (!ready)
    return (
      <p className="empty" role="status">
        {canShare
          ? "You are offline. Shared exercises need a connection."
          : "Sign in to browse exercises other people have shared."}
      </p>
    );
  if (status === "loading" && !hasRows)
    return (
      <p className="empty" role="status">
        Loading shared exercises…
      </p>
    );
  if (status === "error" && !hasRows)
    return (
      <p className="empty" role="status">
        Could not load shared exercises.{" "}
        <button type="button" className="text-button" onClick={onRetry}>
          Retry
        </button>
      </p>
    );
  if (!items.length)
    return (
      <p className="empty" role="status">
        {narrowed
          ? "No shared exercises match."
          : "Nothing new has been shared yet."}
      </p>
    );
  return (
    <div className="list">
      {items.map((e) => (
        <div className="row exercise-row" key={e.id}>
          <span className="row-main">
            <span className="row-title exercise-name">{e.name}</span>
            <span className="row-sub">
              {[e.category, e.equipment].filter(Boolean).join(" · ")}
            </span>
          </span>
          <button
            type="button"
            className="unhide"
            aria-label={"Add " + e.name}
            disabled={!!adding}
            onClick={() => onAdd(e.id)}
          >
            {adding === e.id ? "Adding…" : "Add"}
          </button>
        </div>
      ))}
    </div>
  );
}
