import { Link as RouterLink } from "react-router-dom";
import { Copy, ShieldCheck } from "lucide-react";
import type { RecordDoc, RoutineRecord } from "@/data/model";
import { exerciseCategory } from "@/data/selectors";
import Sheet from "@/components/ui/Sheet";
import Switch from "@/components/ui/Switch";
import RoutineTile from "@/components/library/RoutineTile";
import { useDisplayName } from "@/hooks/useDisplayName";
import { sharedByLine } from "@/lib/display-name";
import { notify } from "@/lib/message-store";
import { estimatedMinutes } from "@/lib/routine-preview";
import { tileIcons } from "@/lib/routine-library";
import { tileMeta } from "@/lib/routine-tile-facts";
import { useT } from "@/i18n/useT";

/** The in-app link that opens a shared routine's preview in Upptäck. */
export const sharedRoutineLink = (sharedId: string) =>
  `${window.location.origin}/library?tab=discover&shared=${encodeURIComponent(sharedId)}`;

/**
 * Dela: the routine's tile exactly as others see it in Upptäck (your name,
 * a length from its sets, + to save), the "Visa i Upptäck" switch (publish or
 * stop sharing), a line that weights, reps and notes never go along and,
 * while it is shared, a link that opens it for anyone signed in.
 */
export default function ShareRoutineSheet({
  routine,
  records,
  canShare,
  ready,
  sharing,
  onClose,
  onShare,
}: {
  routine: RoutineRecord | null;
  records: Record<string, RecordDoc>;
  /** Signed in, so sharing works at all. */
  canShare: boolean;
  /** Signed in and online. */
  ready: boolean;
  /** A share or unshare is under way. */
  sharing: boolean;
  onClose: () => void;
  /** Shares (true) or stops sharing (false). */
  onShare: (routine: RoutineRecord, on: boolean) => void;
}) {
  const { t } = useT();
  const me = useDisplayName();
  const payload = routine?.payload;
  const sharedId = payload?.sharedId;
  const link = sharedId ? sharedRoutineLink(sharedId) : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      notify.success(t("shareSheet.copied"));
    } catch {
      notify.error(t("shareSheet.copyFailed"));
    }
  };
  return (
    <Sheet
      open={!!routine}
      onClose={onClose}
      className="share-sheet"
      title={t("shareSheet.title", { name: payload?.name ?? "" })}
    >
      {routine && payload && (
        <>
          <section className="share-preview" aria-labelledby="share-preview">
            <h3 className="group-title" id="share-preview">
              {t("shareSheet.preview")}
            </h3>
            <div className="share-preview-tile">
              <RoutineTile
                inert
                name={payload.name}
                {...tileIcons(payload.exercises, (id) =>
                  exerciseCategory(records, id),
                )}
                meta={tileMeta(
                  payload.exercises.length,
                  estimatedMinutes(payload),
                )}
                foot={sharedByLine(me.name)}
                openLabel={payload.name}
                onOpen={() => {}}
                action={{ kind: "save", label: t("discover.save") }}
              />
            </div>
          </section>
          {canShare ? (
            <Switch
              label={t("shareSheet.show")}
              hint={
                ready ? t("shareSheet.showHint") : t("shareSheet.offline")
              }
              checked={!!sharedId}
              disabled={!ready || sharing}
              onChange={(on) => onShare(routine, on)}
            />
          ) : (
            <RouterLink className="btn-secondary btn-block" to="/auth">
              {t("exercises.signInToShare")}
            </RouterLink>
          )}
          <p className="sheet-hint share-private">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>{t("shareSheet.private")}</span>
          </p>
          {sharedId && (
            <div className="share-link">
              <input
                readOnly
                value={link}
                aria-label={t("shareSheet.copy")}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void copy()}
              >
                <Copy size={18} aria-hidden="true" />
                {t("shareSheet.copy")}
              </button>
              <p className="row-sub">{t("shareSheet.linkHint")}</p>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
