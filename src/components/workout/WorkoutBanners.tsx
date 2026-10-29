type Props = {
  changedElsewhere: boolean;
  error: string | null;
  editing: boolean;
  busy: boolean;
  onLoadLatest: () => void;
  onKeepMine: () => void;
  onRetry: () => void;
};

/** Notices over the workout: changed on another device, and a failed save. */
export default function WorkoutBanners({
  changedElsewhere,
  error,
  editing,
  busy,
  onLoadLatest,
  onKeepMine,
  onRetry,
}: Props) {
  return (
    <>
      {changedElsewhere && !busy && (
        <div className="banner workout-banner" role="alert">
          <p>This workout was changed in another tab or on another device.</p>
          <div className="banner-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onLoadLatest}
            >
              Load the latest version
            </button>
            <button type="button" className="btn-quiet" onClick={onKeepMine}>
              Keep my entries
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="banner banner-danger workout-banner" role="alert">
          <p>{error}</p>
          {!editing && (
            <div className="banner-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={onRetry}
              >
                Retry saving
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
