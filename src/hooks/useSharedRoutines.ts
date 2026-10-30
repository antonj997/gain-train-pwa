import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import type { Routine } from "@/data/model";
import {
  fetchSharedRoutines,
  publishRoutine,
  unpublishRoutine,
  updateSharedRoutine,
} from "@/data/shared-routines";
import { supabase } from "@/integrations/supabase/client";
import {
  SHARED_ROUTINE_LIMITS,
  SharedRoutineError,
  addedRoutineIds,
  importSharedRoutine,
  sharedRoutineChanged,
  toSharedRoutineInsert,
  type SharedRoutineRow,
} from "@/lib/shared-routines";
import { t } from "@/i18n";

export type SharedRoutineStatus = "loading" | "error" | "ready";

/** The message for a failed share: a limit the routine or the server set, or a retry. */
function shareFailure(cause: unknown, name: string) {
  if (cause instanceof SharedRoutineError)
    return cause.reason === "tooMany"
      ? t("sharedRoutines.tooMany", { max: SHARED_ROUTINE_LIMITS.exercises })
      : t("sharedRoutines.tooBig");
  const error = cause as { code?: unknown; message?: unknown } | null;
  if (error?.code === "P0001" && typeof error.message === "string")
    return / a day/.test(error.message)
      ? t("sharedRoutines.limitDay")
      : t("sharedRoutines.limitTotal");
  return t("shared.shareFailed", { name });
}

/**
 * Shared routines: the list everyone shared (fetched while `browsing`, signed
 * in and online), adding a copy of one, and sharing or unsharing the user's
 * own. `onSharedId` tells an open routine draft that its shared id changed.
 */
export function useSharedRoutines({
  browsing,
  onSharedId,
}: {
  browsing: boolean;
  onSharedId: (routineId: string, sharedId: string | null) => void;
}) {
  const { state, save, online } = useData();
  const { account, user } = useAuth();
  const [shared, setShared] = useState<{
    rows: SharedRoutineRow[];
    status: SharedRoutineStatus;
  }>({ rows: [], status: "loading" });
  const [adding, setAdding] = useState("");
  const [sharing, setSharing] = useState(false);
  const canShare = !!supabase && !!user && account === user.id;
  const ready = canShare && online;

  const load = (force: boolean) => {
    let current = true;
    setShared((s) => ({ ...s, status: "loading" }));
    fetchSharedRoutines(force)
      .then((rows) => current && setShared({ rows, status: "ready" }))
      .catch(() => current && setShared((s) => ({ ...s, status: "error" })));
    return () => {
      current = false;
    };
  };
  useEffect(() => {
    if (!browsing || !ready) return;
    return load(false);
    // Fetched again for another account.
  }, [browsing, ready, user?.id]);

  const added = useMemo(() => addedRoutineIds(state.records), [state.records]);

  const routinePayload = (id: string) => {
    const record = state.records[id];
    return record?.kind === "routine" && !record.deleted
      ? record.payload
      : null;
  };
  const setSharedId = async (id: string, sharedId: string | null) => {
    const payload = routinePayload(id);
    if (!payload) return;
    const next = structuredClone(payload);
    if (sharedId) next.sharedId = sharedId;
    else delete next.sharedId;
    await save(id, "routine", next);
    onSharedId(id, sharedId);
  };

  return {
    canShare,
    ready,
    status: shared.status,
    /** True when rows have been fetched before, even if a refresh failed. */
    hasRows: shared.rows.length > 0,
    rows: browsing ? shared.rows : [],
    /** Ids of shared routines the user already has a copy of. */
    added,
    retry: () => void load(true),
    adding,
    sharing,
    /** Copies a shared routine, and the sharer's own exercises it uses, into the user's. */
    add: async (id: string) => {
      const row = shared.rows.find((r) => r.id === id);
      if (!row || row.mine || adding) return;
      const copy = importSharedRoutine(row, state.records);
      if (!copy) {
        toast.error(t("sharedRoutines.unusable", { name: row.name }));
        return;
      }
      setAdding(row.id);
      try {
        // Exercises first: a retry after a failure reuses them by name.
        for (const exercise of copy.exercises)
          await save(exercise.id, "exercise", exercise.payload);
        await save(crypto.randomUUID(), "routine", copy.routine);
        toast(t("sharedRoutines.addedToast", { name: copy.routine.name }));
      } catch {
        toast.error(t("shared.addFailed", { name: row.name }));
      } finally {
        setAdding("");
      }
    },
    /** Publishes a routine. Resolves true when it was shared. */
    share: async (id: string) => {
      const payload = routinePayload(id);
      if (!payload || sharing) return false;
      setSharing(true);
      let sharedId = "";
      try {
        sharedId = await publishRoutine(
          toSharedRoutineInsert(payload, state.records),
        );
        await setSharedId(id, sharedId);
        toast(t("shared.sharedOk", { name: payload.name }));
        return true;
      } catch (cause) {
        // Remove the row again if only the local save failed, so nothing is half done.
        if (sharedId) await unpublishRoutine(sharedId).catch(() => {});
        toast.error(shareFailure(cause, payload.name));
        return false;
      } finally {
        setSharing(false);
      }
    },
    /** Removes a routine from the shared library. Resolves true when done. */
    stopSharing: async (id: string) => {
      const payload = routinePayload(id);
      if (!payload?.sharedId || sharing) return false;
      setSharing(true);
      try {
        await unpublishRoutine(payload.sharedId);
      } catch {
        toast.error(t("shared.stopFailed", { name: payload.name }));
        setSharing(false);
        return false;
      }
      try {
        await setSharedId(id, null);
        toast(t("shared.stopped", { name: payload.name }));
        return true;
      } catch {
        toast.error(t("shared.phoneFailed"));
        return false;
      } finally {
        setSharing(false);
      }
    },
    /** Keeps the published copy in step after the routine is saved. */
    syncEdit: async (before: Routine | null, after: Routine) => {
      const sharedId = before?.sharedId;
      if (!sharedId || !before) return;
      if (!sharedRoutineChanged(before, after, state.records)) return;
      try {
        await updateSharedRoutine(
          sharedId,
          toSharedRoutineInsert(after, state.records),
        );
      } catch {
        toast.error(t("shared.staleCopy"));
      }
    },
  };
}
