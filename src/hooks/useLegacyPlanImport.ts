import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import { derivedUuid } from "@/data/exercises";
import { today } from "@/data/model";
import { legacyPlanToPlan } from "@/data/plans";
import { local, storageKeys } from "@/lib/storage";

/**
 * Moves the plan the earlier version kept on this device into a synced plan
 * record, once, and then removes the device copy. If saving fails the copy stays
 * and the next start tries again.
 */
export function useLegacyPlanImport() {
  const { ready, state, save } = useData();
  const { account } = useAuth();
  const tried = useRef("");
  useEffect(() => {
    if (!ready || tried.current === account) return;
    tried.current = account;
    const key = storageKeys.legacyPlan(account);
    const raw = local.getItem(key);
    if (raw === null) return;
    const id = derivedUuid("legacy-plan:" + account);
    const plan = state.records[id] ? null : legacyPlanToPlan(raw, today());
    if (!plan) {
      local.removeItem(key);
      return;
    }
    save(id, "plan", plan)
      .then(() => local.removeItem(key))
      .catch(() => undefined);
  }, [ready, account, state.records, save]);
}
