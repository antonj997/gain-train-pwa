import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import { checkAdmin, countOpenReports, knownAdmin } from "@/data/feedback";
import { supabase } from "@/integrations/supabase/client";

/**
 * Whether the signed-in user is an admin (asked once a session) and, for an
 * admin, how many reports are open. Always false signed out.
 */
export function useAdmin({ withCount = false } = {}) {
  const { user, account } = useAuth();
  const { online } = useData();
  const id = supabase && user && account === user.id ? user.id : "";
  const [admin, setAdmin] = useState<boolean | undefined>(() =>
    id ? knownAdmin(id) : false,
  );
  const [openCount, setOpenCount] = useState<number | null>(null);

  useEffect(() => {
    if (!id) {
      setAdmin(false);
      return;
    }
    const known = knownAdmin(id);
    setAdmin(known);
    if (known !== undefined || !online) return;
    let current = true;
    checkAdmin(id)
      .then((value) => current && setAdmin(value))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [id, online]);

  useEffect(() => {
    if (!withCount || !admin || !online) return;
    let current = true;
    countOpenReports()
      .then((count) => current && setOpenCount(count))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [withCount, admin, online]);

  return {
    /** Undefined while it is not known yet (offline before the first check). */
    isAdmin: admin,
    openCount: admin ? openCount : null,
  };
}
