import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import PageHeader from "@/components/PageHeader";
import BackButton from "@/components/ui/BackButton";
import SharedRoutineList from "@/components/library/SharedRoutineList";
import SharedRoutinePreviewSheet from "@/components/library/SharedRoutinePreview";
import { routines } from "@/data/selectors";
import { usePageBack } from "@/hooks/usePageTransitions";
import { useRetainedDraft } from "@/hooks/useRetainedDraft";
import { useSharedRoutines } from "@/hooks/useSharedRoutines";
import { draftKey, parseRoutineDraft } from "@/lib/drafts";
import { routineAverageMinutes } from "@/lib/routine-preview";
import { routineEditPath } from "@/lib/routes";
import { useT } from "@/i18n/useT";

/**
 * Library → Shared routines, a subscreen: routines people shared, Add on
 * someone else's, and the full preview (add, or edit and stop sharing your
 * own). Reached from the last row of Library → Routines.
 */
export default function LibraryShared() {
  const { state } = useData();
  const { account } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const back = usePageBack("/library");
  // An unfinished routine draft follows its routine's shared id, as in Library.
  const draft = useRetainedDraft(
    draftKey(account, "routine"),
    parseRoutineDraft,
  );
  const shared = useSharedRoutines({
    browsing: true,
    onSharedId: (id, sharedId) => {
      const edit = draft.value;
      if (edit?.id !== id) return;
      const data = structuredClone(edit.data);
      if (sharedId) data.sharedId = sharedId;
      else delete data.sharedId;
      draft.replace({ ...edit, data });
    },
  });
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewRow = shared.rows.find((r) => r.id === previewId) ?? null;
  const previewOwn = previewRow?.mine
    ? routines(state.records).find((r) => r.payload.sharedId === previewRow.id)
    : undefined;
  return (
    <div className="page library-page shared-page">
      <PageHeader
        eyebrow={t("library.title")}
        title={t("library.sharedTitle")}
        leading={<BackButton onClick={back} />}
      />
      <SharedRoutineList
        canShare={shared.canShare}
        ready={shared.ready}
        status={shared.status}
        hasRows={shared.hasRows}
        rows={shared.rows}
        added={shared.added}
        adding={shared.adding}
        onRetry={shared.retry}
        onAdd={(id) => void shared.add(id)}
        onPreview={setPreviewId}
      />
      <SharedRoutinePreviewSheet
        row={previewRow}
        records={state.records}
        minutes={
          previewOwn
            ? routineAverageMinutes(previewOwn.id, state.records)
            : null
        }
        added={!!previewRow && shared.added.has(previewRow.id)}
        adding={!!previewRow && shared.adding === previewRow.id}
        busy={
          shared.sharing ||
          (!!shared.adding && shared.adding !== previewRow?.id)
        }
        canEdit={!!previewOwn}
        onClose={() => setPreviewId(null)}
        onAdd={async () => {
          if (previewRow && (await shared.add(previewRow.id)))
            setPreviewId(null);
        }}
        onEdit={() => {
          if (!previewOwn) return;
          setPreviewId(null);
          // The routine editor lives in Library → Routines.
          navigate(routineEditPath(previewOwn.id));
        }}
        onStopSharing={async () => {
          if (previewRow && (await shared.unshare(previewRow.id)))
            setPreviewId(null);
        }}
      />
    </div>
  );
}
