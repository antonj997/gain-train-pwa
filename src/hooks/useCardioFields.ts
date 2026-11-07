import { useMemo } from "react";
import { notify } from "@/lib/message-store";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import { useStableCallback } from "@/hooks/useStableCallback";
import {
  libraryOf,
  savedCardioFields,
  withCardioFields,
} from "@/data/exercises";
import { cardioFieldsOf, type CardioFields } from "@/lib/cardio";
import { t } from "@/i18n";

/**
 * The cardio fields each exercise shows (chosen with "Fields…", saved in the
 * synced library record) and a way to change them. `fieldsFor` returns the
 * same object for an exercise until its saved choice changes, so memoised
 * cards skip renders.
 */
export function useCardioFields() {
  const { state, saveLibrary } = useData();
  const { account } = useAuth();
  const saved = savedCardioFields(state.records, account);
  // The records change with every autosave; the choice rarely does.
  const key = JSON.stringify(saved);
  const fieldsFor = useMemo(() => {
    const entries = JSON.parse(key) as Record<string, unknown>;
    const cache = new Map<string, CardioFields>();
    return (exerciseId: string) => {
      let fields = cache.get(exerciseId);
      if (!fields) {
        fields = cardioFieldsOf(entries[exerciseId], exerciseId);
        cache.set(exerciseId, fields);
      }
      return fields;
    };
  }, [key]);
  // Stable, so passing it to every card keeps them memoised.
  const setFields = useStableCallback(
    (exerciseId: string, fields: CardioFields) =>
      saveLibrary(
        withCardioFields(libraryOf(state.records, account), exerciseId, fields),
      ).catch(() => {
        notify.error(t("cardio.fieldsFailed"));
      }),
  );
  return { fieldsFor, setFields };
}
