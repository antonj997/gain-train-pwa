import { useRef, useState } from "react";
import { MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import type { SwipeAction } from "@/components/gestures/Swipeable";
import { useData } from "@/contexts/useData";
import type { RoutineRecord } from "@/data/model";
import { routines as routineRecords } from "@/data/selectors";
import { unpublishRoutine } from "@/data/shared-routines";
import { useSharedRoutines } from "@/hooks/useSharedRoutines";
import { notify, offerUndo } from "@/lib/message-store";
import { errorMessage } from "@/lib/errors";
import ListRow from "@/components/ui/ListRow";
import Sheet from "@/components/ui/Sheet";
import { t } from "@/i18n";

/**
 * A routine's ⋯ menu (Edit, Share or Stop sharing, Delete) and deleting a
 * routine, for Library → Routines and Train's Your routines. Deleting leaves
 * an undo placeholder where the card was, in the list named `scope`.
 */
export function useRoutineMenu({
  scope,
  onEdit,
  onSharedId = () => {},
}: {
  scope: string;
  onEdit: (routine: RoutineRecord) => void;
  /** An open draft of the routine follows its shared id. */
  onSharedId?: (routineId: string, sharedId: string | null) => void;
}) {
  const { state, save, deleteRecord } = useData();
  const shared = useSharedRoutines({ browsing: false, onSharedId });
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  // Where the card whose menu is open sits in the list drawn.
  const menuIndex = useRef(0);
  const records = routineRecords(state.records);
  const menuRoutine = records.find((r) => r.id === menu);

  /** Deletes a routine; `index` is its place in the list `scope` draws. */
  const remove = async (r: RoutineRecord, index: number) => {
    if (lock.current) return;
    const sharedId = r.payload.sharedId;
    // A shared routine leaves the shared library first, while its record
    // still holds the id needed to remove it.
    if (sharedId && !shared.ready) {
      notify.error(t("exercises.stopSharingFirst", { name: r.payload.name }));
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      if (sharedId)
        try {
          await unpublishRoutine(sharedId);
        } catch {
          notify.error(
            t("exercises.unpublishFailed", { name: r.payload.name }),
          );
          return;
        }
      await deleteRecord(r.id);
      setMenu(null);
      // Undo brings the routine back unshared: its shared row is gone.
      const restored = structuredClone(r.payload);
      delete restored.sharedId;
      offerUndo({
        scope,
        index,
        text: t("routines.deleted", { name: r.payload.name }),
        undo: () => save(r.id, "routine", restored),
        failed: t("routines.restoreFailed"),
      });
    } catch (cause) {
      notify.error(errorMessage(cause, t("routines.saveFailed")));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const sheet = (
    <Sheet
      open={!!menuRoutine}
      onClose={() => setMenu(null)}
      title={menuRoutine?.payload.name}
    >
      {menuRoutine && (
        <>
          <div className="list">
            <ListRow
              title={t("common.edit")}
              leading={<Pencil size={20} aria-hidden="true" />}
              disabled={busy}
              onClick={() => {
                setMenu(null);
                onEdit(menuRoutine);
              }}
            />
            {shared.canShare ? (
              <ListRow
                title={
                  shared.sharing
                    ? t("exercises.working")
                    : menuRoutine.payload.sharedId
                      ? t("exercises.stopSharing")
                      : t("exercises.shareToLibrary")
                }
                leading={<Share2 size={20} aria-hidden="true" />}
                disabled={busy || shared.sharing}
                onClick={async () => {
                  const done = menuRoutine.payload.sharedId
                    ? await shared.stopSharing(menuRoutine.id)
                    : await shared.share(menuRoutine.id);
                  if (done) setMenu(null);
                }}
              />
            ) : (
              <ListRow
                title={t("exercises.signInToShare")}
                leading={<Share2 size={20} aria-hidden="true" />}
                to="/auth"
              />
            )}
            <ListRow
              tone="danger"
              title={t("routines.delete")}
              leading={<Trash2 size={20} aria-hidden="true" />}
              disabled={busy}
              onClick={() =>
                void remove(menuRoutine, menuIndex.current)
              }
            />
          </div>
          {shared.canShare && (
            <p className="row-sub">{t("sharedRoutines.menuNote")}</p>
          )}
        </>
      )}
    </Sheet>
  );
  return {
    busy,
    remove,
    /** Opens the ⋯ menu of the routine at `index` in the list drawn. */
    open: (id: string, index: number) => {
      menuIndex.current = index;
      setMenu(id);
    },
    sheet,
  };
}

/** A routine card's swipe-left buttons: More (its ⋯ menu) and Delete. */
export const routineSwipeActions = (
  more: () => void,
  remove: () => void,
): SwipeAction[] => [
  {
    key: "more",
    label: t("swipe.more"),
    icon: <MoreHorizontal size={18} aria-hidden="true" />,
    onSelect: more,
  },
  {
    key: "delete",
    label: t("swipe.delete"),
    icon: <Trash2 size={18} aria-hidden="true" />,
    tone: "danger",
    onSelect: remove,
  },
];
