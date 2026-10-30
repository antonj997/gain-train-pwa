import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import { fetchDisplayName, saveDisplayName } from "@/data/profiles";
import { supabase } from "@/integrations/supabase/client";

// The last name read or saved for each account, so reopening Settings shows it at once.
const known = new Map<string, string | null>();

export type DisplayNameStatus = "loading" | "error" | "ready";

/**
 * The signed-in user's display name (from `profiles`), read while signed in
 * and online. `save` stores a new one, or with null removes it.
 */
export function useDisplayName() {
  const { user, account } = useAuth();
  const { online } = useData();
  const id = user && account === user.id ? user.id : "";
  const [state, setState] = useState<{
    name: string | null;
    status: DisplayNameStatus;
  }>(() => ({
    name: known.get(id) ?? null,
    status: known.has(id) ? "ready" : "loading",
  }));
  const available = !!supabase && !!id;

  useEffect(() => {
    if (!available || !online) return;
    let current = true;
    setState(
      known.has(id)
        ? { name: known.get(id) ?? null, status: "ready" }
        : { name: null, status: "loading" },
    );
    fetchDisplayName(id)
      .then((name) => {
        known.set(id, name);
        if (current) setState({ name, status: "ready" });
      })
      .catch(() => {
        if (current)
          setState((s) => ({
            ...s,
            status: known.has(id) ? "ready" : "error",
          }));
      });
    return () => {
      current = false;
    };
  }, [available, online, id]);

  return {
    /** Signed in, so a name can be set. */
    available,
    online,
    name: available ? state.name : null,
    status: state.status,
    save: async (name: string | null) => {
      await saveDisplayName(id, name);
      known.set(id, name);
      setState({ name, status: "ready" });
    },
  };
}
