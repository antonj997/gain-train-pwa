import { useT } from "@/i18n/useT";
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
  const { t } = useT();
  return (
    <>
      {changedElsewhere && !busy && (
        <div className="banner workout-banner" role="alert">
          <p>{t("workout.changedElsewhere")}</p>
          <div className="banner-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onLoadLatest}
            >
              {t("workout.loadLatest")}
            </button>
            <button type="button" className="btn-quiet" onClick={onKeepMine}>
              {t("workout.keepMine")}
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
                {t("workout.retrySaving")}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
