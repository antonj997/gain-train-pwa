import { useState } from "react";
import { Check } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import ListRow from "@/components/ui/ListRow";
import Sheet from "@/components/ui/Sheet";
import { categories } from "@/data/catalogue";
import type { RoutineGroup } from "@/data/model";
import { errorMessage } from "@/lib/errors";
import { t } from "@/i18n";
import { categoryLabel } from "@/lib/catalogue-labels";

const suggestable = categories.filter((c) => c !== "Other");

/** Creates, edits or deletes a named group of routines. `group` is null for a new one. */
export default function GroupEditor({
  open,
  group,
  routines,
  onSave,
  onDelete,
  onClose,
}: {
  open: boolean;
  group: RoutineGroup | null;
  routines: readonly { id: string; payload: { name: string } }[];
  onSave: (group: RoutineGroup) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<RoutineGroup>(
    () =>
      group ?? {
        id: crypto.randomUUID(),
        name: "",
        routineIds: [],
        categories: [],
      },
  );
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const toggle = (key: "routineIds" | "categories", value: string) =>
    setDraft((d) => ({
      ...d,
      [key]: d[key].includes(value)
        ? d[key].filter((x) => x !== value)
        : [...d[key], value],
    }));
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await work();
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, t("group.saveFailed")));
    } finally {
      setBusy(false);
      setDeleting(false);
    }
  };
  return (
    <>
      <Sheet
        open={open}
        size="full"
        onClose={() => {
          if (!busy) onClose();
        }}
        title={group ? t("group.edit") : t("plan.newGroup")}
        description={t("group.description")}
      >
        <label>
          {t("group.name")}
          <input
            value={draft.name}
            maxLength={100}
            placeholder={t("group.namePlaceholder")}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <section aria-labelledby="group-routines">
          <h3 className="group-title" id="group-routines">
            {t("group.routines")}
          </h3>
          {routines.length ? (
            <div className="list">
              {routines.map((r) => (
                <ListRow
                  key={r.id}
                  title={r.payload.name}
                  onClick={() => toggle("routineIds", r.id)}
                  trailing={
                    draft.routineIds.includes(r.id) ? (
                      <Check
                        size={20}
                        className="plan-check"
                        aria-label={t("group.inGroup")}
                      />
                    ) : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <p className="row-sub">{t("group.noRoutines")}</p>
          )}
        </section>
        <section aria-labelledby="group-categories">
          <h3 className="group-title" id="group-categories">
            {t("group.suggestFrom")}
          </h3>
          <div
            className="filters"
            role="group"
            aria-labelledby="group-categories"
          >
            {suggestable.map((c) => (
              <button
                key={c}
                type="button"
                className="filter-chip"
                aria-pressed={draft.categories.includes(c)}
                onClick={() => toggle("categories", c)}
              >
                {categoryLabel(c)}
              </button>
            ))}
          </div>
        </section>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="btn-primary btn-block"
          disabled={busy || !draft.name.trim()}
          onClick={() =>
            void run(() => onSave({ ...draft, name: draft.name.trim() }))
          }
        >
          {busy ? t("common.saving") : t("group.save")}
        </button>
        {group && (
          <button
            type="button"
            className="btn-danger btn-block"
            disabled={busy}
            onClick={() => setDeleting(true)}
          >
            {t("group.delete")}
          </button>
        )}
      </Sheet>
      <ConfirmDialog
        open={deleting}
        title={t("plan.deleteTitle", { name: group?.name ?? "" })}
        description={t("group.deleteText")}
        cancelLabel={t("group.keep")}
        confirmLabel={busy ? t("history.deleting") : t("group.delete")}
        busy={busy}
        onCancel={() => setDeleting(false)}
        onConfirm={() => group && void run(() => onDelete(group.id))}
      />
    </>
  );
}
