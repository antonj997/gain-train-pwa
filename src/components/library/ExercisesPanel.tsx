import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "@/lib/errors";
import {
  Eye,
  EyeOff,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  Star,
  Trash2,
} from "lucide-react";
import { useData } from "@/contexts/useData";
import { useAuth } from "@/contexts/useAuth";
import { useRetainedDraft } from "@/hooks/useRetainedDraft";
import { draftKey, parseCustomDraft } from "@/lib/drafts";
import { catalogue, categories, equipmentTypes } from "@/data/catalogue";
import { useHiddenExercises } from "@/hooks/useHiddenExercises";
import FacetChips from "@/components/FacetChips";
import { progressFor, exerciseStats } from "@/data/analytics";
import { labelSet, today } from "@/data/model";
import { completedWorkouts } from "@/data/selectors";
import {
  favouriteIds,
  favouriteMarker,
  favouriteNote,
  ownExercises,
} from "@/data/exercises";
import ConfirmDialog from "@/components/ConfirmDialog";
import Sheet from "@/components/ui/Sheet";
import {
  exerciseSub,
  filterExercises,
  groupExercises,
  type ExerciseFilter,
  type LibraryExercise,
} from "@/lib/library";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchShared,
  publishExercise,
  unpublishExercise,
  updateSharedExercise,
} from "@/data/shared";
import {
  fromSharedRow,
  sharedFieldsChanged,
  visibleShared,
  type SharedRow,
} from "@/lib/shared-exercises";
type Filter = ExerciseFilter | "shared";
const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "yours", label: "Yours" },
  { value: "recent", label: "Recently used" },
  { value: "hidden", label: "Hidden" },
  { value: "shared", label: "Shared" },
];

/** Library → Exercises: search, filters, groups and the custom exercise editor. */
export default function ExercisesPanel() {
  const { state, save, deleteRecord } = useData();
  const { account, user } = useAuth();
  const { online } = useData();
  const draft = useRetainedDraft(
    draftKey(account, "exercise"),
    parseCustomDraft,
  );
  const edit = draft.value;
  const setEdit = draft.replace;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState("");
  const [equipment, setEquipment] = useState("");
  const { hidden, setHidden } = useHiddenExercises();
  const [menu, setMenu] = useState<LibraryExercise | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [shared, setShared] = useState<{
    rows: SharedRow[];
    status: "loading" | "error" | "ready";
  }>({ rows: [], status: "loading" });
  const [adding, setAdding] = useState("");
  const [sharing, setSharing] = useState(false);
  const canShare = !!supabase && !!user && account === user.id;
  const sharedReady = canShare && online;
  const me = user?.id ?? "";
  const now = today();
  // The Shared list is fetched on demand each time the chip is chosen (a short
  // in-memory cache sits in data/shared.ts), and not at all when signed out or offline.
  useEffect(() => {
    if (filter !== "shared" || !sharedReady) return;
    let current = true;
    setShared((s) => ({ ...s, status: "loading" }));
    fetchShared(me)
      .then((rows) => current && setShared({ rows, status: "ready" }))
      .catch(() => current && setShared((s) => ({ ...s, status: "error" })));
    return () => {
      current = false;
    };
  }, [filter, sharedReady, me]);
  const all = useMemo<LibraryExercise[]>(() => {
    const records = Object.values(state.records);
    const favourites = favouriteIds(state.records);
    const lastDates = new Map<string, string>();
    for (const r of completedWorkouts(state.records))
      for (const ex of r.payload.exercises)
        if (!lastDates.has(ex.exerciseId))
          lastDates.set(ex.exerciseId, r.payload.date);
    const bests = new Map(
      progressFor(records).map((item) => [
        item.id,
        labelSet(exerciseStats(item).best.set),
      ]),
    );
    const extra = (id: string) => ({
      lastDate: lastDates.get(id) ?? null,
      best: bests.get(id) ?? null,
    });
    return [
      ...catalogue.map((e) => ({
        ...e,
        note: "",
        custom: false,
        hidden: hidden.has(e.id),
        favourite: favourites.has(e.id),
        ...extra(e.id),
      })),
      ...ownExercises(state.records).map((e) => ({
        ...e,
        custom: true,
        hidden: hidden.has(e.id),
        ...extra(e.id),
      })),
    ];
  }, [state.records, hidden]);
  const groups = useMemo(
    () =>
      filter === "shared"
        ? []
        : groupExercises(
            filterExercises(all, search, filter, { category, equipment }),
            filter,
            !!search.trim(),
          ),
    [all, search, filter, category, equipment],
  );
  const sharedItems = useMemo(() => {
    if (filter !== "shared") return [];
    const added = new Set(
      ownExercises(state.records).flatMap((e) =>
        e.sharedFrom ? [e.sharedFrom] : [],
      ),
    );
    return filterExercises(
      visibleShared(shared.rows, added).map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        equipment: r.equipment ?? undefined,
        aliases: r.aliases,
        custom: false,
        favourite: false,
        note: "",
        lastDate: null,
        best: null,
      })),
      search,
      "all",
      { category, equipment },
    );
  }, [filter, shared.rows, state.records, search, category, equipment]);
  const addShared = async (item: LibraryExercise) => {
    const row = shared.rows.find((r) => r.id === item.id);
    if (!row || adding) return;
    setAdding(row.id);
    try {
      await save(crypto.randomUUID(), "exercise", fromSharedRow(row));
      toast(`${row.name} added to your exercises`);
    } catch {
      toast.error(`Could not add ${row.name}. Retry.`);
    } finally {
      setAdding("");
    }
  };
  const customPayload = (id: string) => {
    const record = state.records[id];
    return record?.kind === "exercise" ? record.payload : null;
  };
  const setSharedId = async (e: LibraryExercise, sharedId: string | null) => {
    const payload = customPayload(e.id);
    if (!payload) return;
    const next = structuredClone(payload);
    if (sharedId) next.sharedId = sharedId;
    else delete next.sharedId;
    await save(e.id, "exercise", next);
    if (edit?.id === e.id) {
      const data = structuredClone(edit.data);
      if (sharedId) data.sharedId = sharedId;
      else delete data.sharedId;
      setEdit({ ...edit, data });
    }
  };
  const shareExercise = async (e: LibraryExercise) => {
    const payload = customPayload(e.id);
    if (!payload || sharing) return;
    setSharing(true);
    let id = "";
    try {
      id = await publishExercise(payload);
      await setSharedId(e, id);
      setMenu(null);
      toast(`${e.name} shared to the library`);
    } catch {
      // Remove the row again if only the local save failed, so nothing is half done.
      if (id) await unpublishExercise(id).catch(() => {});
      toast.error(`Could not share ${e.name}. Nothing changed; retry.`);
    } finally {
      setSharing(false);
    }
  };
  const stopSharing = async (e: LibraryExercise) => {
    if (!e.sharedId || sharing) return;
    setSharing(true);
    try {
      await unpublishExercise(e.sharedId);
    } catch {
      toast.error(`Could not stop sharing ${e.name}. Nothing changed; retry.`);
      setSharing(false);
      return;
    }
    try {
      await setSharedId(e, null);
      setMenu(null);
      toast(`${e.name} is no longer shared`);
    } catch {
      toast.error(
        "Removed from the library. Could not update this phone; retry.",
      );
    } finally {
      setSharing(false);
    }
  };
  const toggleFavourite = async (e: (typeof all)[number]) => {
    try {
      if (!e.custom) {
        const fav = favouriteMarker(state.records, e.id);
        await save(
          fav?.id || crypto.randomUUID(),
          "exercise",
          {
            name: e.name,
            category: e.category,
            note: favouriteNote(e.id),
            favourite: true,
          },
          !!fav,
        );
      } else
        await save(e.id, "exercise", {
          ...customPayload(e.id),
          name: e.name,
          category: e.category,
          note: e.note,
          favourite: !e.favourite,
        });
    } catch {
      toast.error("Could not update favourite. Retry.");
    }
  };
  const toggleHidden = async (e: LibraryExercise, hide: boolean) => {
    try {
      await setHidden(e.id, hide);
      setMenu(null);
      toast(hide ? `${e.name} hidden` : `${e.name} is back`);
    } catch {
      toast.error(`Could not ${hide ? "hide" : "unhide"} ${e.name}. Retry.`);
    }
  };
  const openEditor = (e: (typeof all)[number]) => {
    if (edit && edit.id !== e.id)
      toast("Resume or discard the existing exercise draft first.");
    else if (!edit) {
      const record = state.records[e.id];
      if (record?.kind === "exercise")
        setEdit({ id: e.id, data: structuredClone(record.payload) });
    }
    setOpen(true);
  };
  const saved = !!edit && edit.id in state.records;
  return (
    <div className="col-12">
      <label className="search-field">
        <Search size={20} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search exercises"
          aria-label="Search exercises"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="filters" role="group" aria-label="Show exercises">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            className="filter-chip"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <FacetChips
        name="Category"
        options={categories}
        value={category}
        onChange={setCategory}
      />
      <FacetChips
        name="Equipment"
        options={equipmentTypes}
        value={equipment}
        onChange={setEquipment}
      />
      {filter === "shared" && (
        <>
          {!sharedReady ? (
            <p className="empty" role="status">
              {canShare
                ? "You are offline. Shared exercises need a connection."
                : "Sign in to browse exercises other people have shared."}
            </p>
          ) : shared.status === "loading" && !shared.rows.length ? (
            <p className="empty" role="status">
              Loading shared exercises…
            </p>
          ) : shared.status === "error" && !shared.rows.length ? (
            <p className="empty" role="status">
              Could not load shared exercises.{" "}
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setShared((s) => ({ ...s, status: "loading" }));
                  fetchShared(me, true)
                    .then((rows) => setShared({ rows, status: "ready" }))
                    .catch(() => setShared((s) => ({ ...s, status: "error" })));
                }}
              >
                Retry
              </button>
            </p>
          ) : sharedItems.length ? (
            <div className="list">
              {sharedItems.map((e) => (
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
                    onClick={() => void addShared(e)}
                  >
                    {adding === e.id ? "Adding…" : "Add"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty" role="status">
              {search.trim() || category || equipment
                ? "No shared exercises match."
                : "Nothing new has been shared yet."}
            </p>
          )}
        </>
      )}
      {groups.map((group) => (
        <section key={group.title} aria-label={group.title}>
          <h2 className="group-title">{group.title}</h2>
          <div className="list">
            {group.items.map((e) => {
              const text = (
                <>
                  <span className="row-title exercise-name">
                    {e.name}
                    {e.custom && <span className="stat-chip">Yours</span>}
                    {e.sharedId && <span className="stat-chip">Shared</span>}
                  </span>
                  <span className="row-sub">{exerciseSub(e, now)}</span>
                </>
              );
              return (
                <div className="row exercise-row" key={e.id}>
                  {e.custom ? (
                    <button
                      type="button"
                      className="row-main row-open"
                      aria-label={"Edit " + e.name}
                      onClick={() => openEditor(e)}
                    >
                      {text}
                    </button>
                  ) : (
                    <span className="row-main">{text}</span>
                  )}
                  {e.hidden ? (
                    <button
                      type="button"
                      className="unhide"
                      aria-label={"Unhide " + e.name}
                      onClick={() => void toggleHidden(e, false)}
                    >
                      Unhide
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={"icon-btn" + (e.favourite ? " starred" : "")}
                        aria-label={
                          (e.favourite ? "Unfavourite " : "Favourite ") + e.name
                        }
                        aria-pressed={e.favourite}
                        onClick={() => void toggleFavourite(e)}
                      >
                        <Star
                          size={20}
                          aria-hidden="true"
                          fill={e.favourite ? "currentColor" : "none"}
                        />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={"More for " + e.name}
                        onClick={() => setMenu(e)}
                      >
                        <MoreHorizontal size={20} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {filter !== "shared" && !groups.length && (
        <p className="empty" role="status">
          {filter === "recent" && !search.trim()
            ? "Exercises you have trained show up here."
            : filter === "yours" && !search.trim()
              ? "Exercises you create show up here."
              : filter === "hidden" && !search.trim()
                ? "Exercises you hide show up here."
                : "No exercises match."}
        </p>
      )}
      {edit && !open && (
        <p className="draft-receipt">
          Unfinished exercise: {edit.data.name || "Untitled"}.{" "}
          {draft.retained
            ? "Kept on this phone."
            : "Keep this page open; storage is unavailable."}
        </p>
      )}
      <button
        type="button"
        className="btn-dashed"
        onClick={() => {
          if (!edit)
            setEdit({
              id: crypto.randomUUID(),
              data: { name: "", category: "Other", note: "", favourite: false },
            });
          setOpen(true);
        }}
      >
        <Plus size={20} aria-hidden="true" />
        {edit ? "Resume exercise draft" : "New exercise"}
      </button>
      <Sheet
        size="full"
        open={open && !!edit}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title={saved ? "Edit exercise" : "New exercise"}
        description="Names in completed workouts stay as originally recorded. Unfinished edits are kept when you close this form."
      >
        {edit && (
          <>
            <label>
              Name
              <input
                value={edit.data.name}
                maxLength={100}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    data: { ...edit.data, name: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Category
              <select
                value={edit.data.category}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    data: { ...edit.data, category: e.target.value },
                  })
                }
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Note
              <textarea
                value={edit.data.note}
                maxLength={1000}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    data: { ...edit.data, note: e.target.value },
                  })
                }
              />
            </label>
            <button
              className="primary"
              disabled={busy || !edit.data.name.trim()}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const before = customPayload(edit.id);
                  await save(edit.id, "exercise", edit.data);
                  setEdit(null);
                  setOpen(false);
                  toast.success("Exercise saved");
                  // Keep the published copy in step with a rename or a new category.
                  const sharedId = before?.sharedId;
                  if (
                    sharedId &&
                    before &&
                    sharedFieldsChanged(before, edit.data)
                  )
                    await updateSharedExercise(sharedId, edit.data).catch(() =>
                      toast.error(
                        "The shared copy still shows the old details. Stop sharing and share again to update it.",
                      ),
                    );
                } catch (cause) {
                  setError(
                    errorMessage(
                      cause,
                      "Could not save. Your draft is kept here.",
                    ),
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Saving…" : "Save exercise"}
            </button>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            {!draft.retained && (
              <p className="field-error" role="alert">
                Storage is unavailable. Keep this form open until saved.
              </p>
            )}
            {saved && (
              <button
                type="button"
                className="btn-danger"
                disabled={busy}
                onClick={() =>
                  setDeleting({ id: edit.id, name: edit.data.name })
                }
              >
                <Trash2 size={18} aria-hidden="true" />
                Delete exercise
              </button>
            )}
            <div className="button-row">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Close and keep draft
              </button>
              <button
                className="text-button danger"
                disabled={busy}
                onClick={() => {
                  setEdit(null);
                  setOpen(false);
                }}
              >
                Discard draft
              </button>
            </div>
          </>
        )}
      </Sheet>
      <Sheet
        open={!!menu}
        onClose={() => setMenu(null)}
        title={menu?.name ?? ""}
        description={menu ? exerciseSub(menu, now) : undefined}
      >
        {menu && (
          <div className="exercise-menu-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                void toggleFavourite(menu);
                setMenu(null);
              }}
            >
              <Star size={18} aria-hidden="true" />
              {menu.favourite ? "Unfavourite" : "Favourite"}
            </button>
            {menu.custom && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const target = menu;
                  setMenu(null);
                  openEditor(target);
                }}
              >
                Edit exercise
              </button>
            )}
            {menu.custom &&
              (canShare ? (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={sharing}
                  onClick={() =>
                    void (menu.sharedId
                      ? stopSharing(menu)
                      : shareExercise(menu))
                  }
                >
                  <Share2 size={18} aria-hidden="true" />
                  {sharing
                    ? "Working…"
                    : menu.sharedId
                      ? "Stop sharing"
                      : "Share to library"}
                </button>
              ) : (
                <Link to="/auth" className="btn-secondary">
                  <Share2 size={18} aria-hidden="true" />
                  Sign in to share
                </Link>
              ))}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void toggleHidden(menu, !menu.hidden)}
            >
              {menu.hidden ? (
                <Eye size={18} aria-hidden="true" />
              ) : (
                <EyeOff size={18} aria-hidden="true" />
              )}
              {menu.hidden ? "Unhide exercise" : "Hide exercise"}
            </button>
            <p className="row-sub">
              Hidden exercises leave the picker and these lists. Saved workouts
              keep them. Find them under Hidden.
            </p>
          </div>
        )}
      </Sheet>
      <ConfirmDialog
        open={!!deleting}
        title={<>Delete {deleting?.name}?</>}
        description="This removes the exercise from your library. Its entries in saved workouts and routines stay intact."
        cancelLabel="Keep exercise"
        confirmLabel={busy ? "Deleting…" : "Delete exercise"}
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting || busy) return;
          const sharedId = customPayload(deleting.id)?.sharedId;
          // A shared exercise leaves the shared library first, while its
          // record still holds the id needed to remove it.
          if (sharedId && !sharedReady) {
            toast.error(
              `Stop sharing ${deleting.name} first. Connect and sign in to remove it from the shared library.`,
            );
            setDeleting(null);
            return;
          }
          setBusy(true);
          try {
            if (sharedId)
              try {
                await unpublishExercise(sharedId);
              } catch {
                toast.error(
                  `Could not remove ${deleting.name} from the shared library. Nothing was deleted; retry.`,
                );
                return;
              }
            await deleteRecord(deleting.id);
            if (edit?.id === deleting.id) setEdit(null);
            setDeleting(null);
            toast("Exercise deleted");
          } catch {
            toast.error("Could not delete. The exercise is still here; retry.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
