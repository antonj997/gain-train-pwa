import { useEffect, useState } from "react";
import { Check, Folder, FolderMinus, FolderPlus } from "lucide-react";
import type { RoutineRecord } from "@/data/model";
import Sheet from "@/components/ui/Sheet";
import { FOLDER_MAX, matchFolder } from "@/lib/routine-library";
import { t } from "@/i18n";

/**
 * "+ Mapp": a name and the routines to put in it. A folder is a name on its
 * routines, so it needs at least one; `preselected` is the routine "Flytta
 * till mapp → Ny mapp…" came from.
 */
export function NewFolderSheet({
  open,
  routines,
  folders,
  preselected,
  busy,
  onClose,
  onCreate,
}: {
  open: boolean;
  routines: readonly RoutineRecord[];
  /** Folder names in use, so "push" joins "Push". */
  folders: readonly string[];
  preselected: readonly string[];
  busy: boolean;
  onClose: () => void;
  onCreate: (folder: string, routineIds: string[]) => void;
}) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  // A fresh form each time it opens.
  useEffect(() => {
    if (!open) return;
    setName("");
    setPicked([...preselected]);
    // The preselection is read once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const folder = matchFolder(name, folders);
  const toggle = (id: string) =>
    setPicked((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    );
  return (
    <Sheet
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      size={routines.length > 5 ? "full" : undefined}
      title={t("folders.newTitle")}
      description={t("folders.hint")}
    >
      <label>
        {t("folders.name")}
        <input
          value={name}
          maxLength={FOLDER_MAX}
          placeholder="Push/Pull/Ben"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <section aria-labelledby="folder-routines">
        <h3 className="group-title" id="folder-routines">
          {t("folders.pick")}
        </h3>
        <div className="list" role="group" aria-labelledby="folder-routines">
          {routines.map((r) => {
            const on = picked.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                className="row folder-pick"
                onClick={() => toggle(r.id)}
              >
                <span className="row-main">
                  <span className="row-title">{r.payload.name}</span>
                  {r.payload.folder && (
                    <span className="row-sub">{r.payload.folder}</span>
                  )}
                </span>
                <span className="folder-check" aria-hidden="true">
                  {on && <Check size={18} strokeWidth={2.6} />}
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <button
        type="button"
        className="btn-primary btn-block"
        disabled={busy || !folder || !picked.length}
        onClick={() => folder && onCreate(folder, picked)}
      >
        <FolderPlus size={18} aria-hidden="true" />
        {t("folders.create")}
      </button>
    </Sheet>
  );
}

/** ⋯ → Flytta till mapp: no folder, a folder in use, or a new one. */
export function MoveFolderSheet({
  routine,
  folders,
  busy,
  onClose,
  onMove,
  onNew,
}: {
  routine: RoutineRecord | null;
  folders: readonly string[];
  busy: boolean;
  onClose: () => void;
  onMove: (routine: RoutineRecord, folder: string | null) => void;
  onNew: (routine: RoutineRecord) => void;
}) {
  const current = routine?.payload.folder ?? null;
  return (
    <Sheet
      open={!!routine}
      onClose={onClose}
      title={t("folders.moveTitle", { name: routine?.payload.name ?? "" })}
    >
      {routine && (
        <div className="sheet-menu" role="group">
          <button
            type="button"
            className={"sheet-menu-item" + (current ? "" : " is-current")}
            aria-pressed={!current}
            disabled={busy}
            onClick={() => onMove(routine, null)}
          >
            <FolderMinus size={20} aria-hidden="true" />
            <span>{t("folders.none")}</span>
            {!current && (
              <Check size={20} className="sheet-menu-check" aria-hidden="true" />
            )}
          </button>
          {folders.map((folder) => (
            <button
              key={folder}
              type="button"
              className={
                "sheet-menu-item" + (folder === current ? " is-current" : "")
              }
              aria-pressed={folder === current}
              disabled={busy}
              onClick={() => onMove(routine, folder)}
            >
              <Folder size={20} aria-hidden="true" />
              <span>{folder}</span>
              {folder === current && (
                <Check
                  size={20}
                  className="sheet-menu-check"
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
          <button
            type="button"
            className="sheet-menu-item"
            disabled={busy}
            onClick={() => onNew(routine)}
          >
            <FolderPlus size={20} aria-hidden="true" />
            <span>{t("folders.newFolder")}</span>
          </button>
        </div>
      )}
    </Sheet>
  );
}
