import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import { ownExercises } from "@/data/exercises";
import type { CustomExercise } from "@/data/model";
import {
  fetchShared,
  publishExercise,
  unpublishExercise,
  updateSharedExercise,
} from "@/data/shared";
import { supabase } from "@/integrations/supabase/client";
import type { LibraryExercise } from "@/lib/library";
import {
  fromSharedRow,
  sharedFieldsChanged,
  visibleShared,
  type SharedRow,
} from "@/lib/shared-exercises";

export type SharedStatus = "loading" | "error" | "ready";

/**
 * The shared exercise library: the list other people shared (fetched while
 * `browsing`, signed in and online), adding one of them, and sharing or
 * unsharing the user's own exercises. `onSharedId` tells an open editor
 * draft that the exercise's shared id changed.
 */
export function useSharedExercises({
  browsing,
  onSharedId,
}: {
  browsing: boolean;
  onSharedId: (exerciseId: string, sharedId: string | null) => void;
}) {
  const { state, save, online } = useData();
  const { account, user } = useAuth();
  const [shared, setShared] = useState<{
    rows: SharedRow[];
    status: SharedStatus;
  }>({ rows: [], status: "loading" });
  const [adding, setAdding] = useState("");
  const [sharing, setSharing] = useState(false);
  const canShare = !!supabase && !!user && account === user.id;
  const ready = canShare && online;
  const me = user?.id ?? "";

  const load = (force: boolean) => {
    let current = true;
    setShared((s) => ({ ...s, status: "loading" }));
    fetchShared(me, force)
      .then((rows) => current && setShared({ rows, status: "ready" }))
      .catch(() => current && setShared((s) => ({ ...s, status: "error" })));
    return () => {
      current = false;
    };
  };
  // Fetched on demand each time the Shared chip is chosen (a short in-memory
  // cache sits in data/shared.ts), and not at all when signed out or offline.
  useEffect(() => {
    if (!browsing || !ready) return;
    return load(false);
    // `load` reads only `me`, which is a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browsing, ready, me]);

  /** Rows other people shared that the user has not added yet. */
  const rows = useMemo(() => {
    if (!browsing) return [];
    const added = new Set(
      ownExercises(state.records).flatMap((e) =>
        e.sharedFrom ? [e.sharedFrom] : [],
      ),
    );
    return visibleShared(shared.rows, added);
  }, [browsing, shared.rows, state.records]);

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
    onSharedId(e.id, sharedId);
  };

  return {
    canShare,
    ready,
    status: shared.status,
    /** True when rows have been fetched before, even if a refresh failed. */
    hasRows: shared.rows.length > 0,
    rows,
    retry: () => void load(true),
    adding,
    sharing,
    add: async (id: string) => {
      const row = shared.rows.find((r) => r.id === id);
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
    },
    /** Publishes a custom exercise. Resolves true when it was shared. */
    share: async (e: LibraryExercise) => {
      const payload = customPayload(e.id);
      if (!payload || sharing) return false;
      setSharing(true);
      let id = "";
      try {
        id = await publishExercise(payload);
        await setSharedId(e, id);
        toast(`${e.name} shared to the library`);
        return true;
      } catch {
        // Remove the row again if only the local save failed, so nothing is half done.
        if (id) await unpublishExercise(id).catch(() => {});
        toast.error(`Could not share ${e.name}. Nothing changed; retry.`);
        return false;
      } finally {
        setSharing(false);
      }
    },
    /** Removes a custom exercise from the shared library. Resolves true when done. */
    stopSharing: async (e: LibraryExercise) => {
      if (!e.sharedId || sharing) return false;
      setSharing(true);
      try {
        await unpublishExercise(e.sharedId);
      } catch {
        toast.error(
          `Could not stop sharing ${e.name}. Nothing changed; retry.`,
        );
        setSharing(false);
        return false;
      }
      try {
        await setSharedId(e, null);
        toast(`${e.name} is no longer shared`);
        return true;
      } catch {
        toast.error(
          "Removed from the library. Could not update this phone; retry.",
        );
        return false;
      } finally {
        setSharing(false);
      }
    },
    /** Keeps the published copy in step after a rename or a new category. */
    syncEdit: async (before: CustomExercise | null, after: CustomExercise) => {
      const sharedId = before?.sharedId;
      if (!sharedId || !before || !sharedFieldsChanged(before, after)) return;
      await updateSharedExercise(sharedId, after).catch(() =>
        toast.error(
          "The shared copy still shows the old details. Stop sharing and share again to update it.",
        ),
      );
    },
  };
}
