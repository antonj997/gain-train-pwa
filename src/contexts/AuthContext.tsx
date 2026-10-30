import { useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { AuthContext } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { eraseAccount } from "@/data/database";
import { local, session, storageKeys, writeStored } from "@/lib/storage";
import { PHONE_ACCOUNT, accountAfterAuthChange } from "@/lib/auth-account";
import {
  RECOVERY_STORAGE_KEY,
  RECOVERY_USER_KEY,
  recoveryRequested,
  recoveredSessionMatches,
} from "@/lib/authRecovery";
import { t } from "@/i18n";
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [account, setAccount] = useState(
      () => local.getItem(storageKeys.account) || PHONE_ACCOUNT,
    ),
    [ready, setReady] = useState(false),
    [passwordRecovery, setPasswordRecovery] = useState(
      () =>
        recoveryRequested(location.href) ||
        session.getItem(RECOVERY_STORAGE_KEY) === "true",
    );
  const [recoveryUserId, setRecoveryUserId] = useState(() =>
    session.getItem(RECOVERY_USER_KEY),
  );
  const finishPasswordRecovery = () => {
    session.removeItem(RECOVERY_STORAGE_KEY);
    session.removeItem(RECOVERY_USER_KEY);
    setRecoveryUserId(null);
    setPasswordRecovery(false);
  };
  useEffect(() => {
    for (const key of storageKeys.legacyRemembered) local.removeItem(key);
    if (!supabase) {
      setReady(true);
      return;
    }
    let active = true;
    const update = (u: User | null) => {
      if (!active) return;
      setUser(u);
      if (u) writeStored(storageKeys.account, u.id);
      setAccount((current) => accountAfterAuthChange(current, u));
      setReady(true);
    };
    const timeout = setTimeout(() => setReady(true), 4000);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") {
        const recoveredId = s?.user.id ?? null;
        setRecoveryUserId(recoveredId);
        if (recoveredId) writeStored(RECOVERY_USER_KEY, recoveredId, session);
        writeStored(RECOVERY_STORAGE_KEY, "true", session);
        setPasswordRecovery(true);
      }
      // The account and its log stay; Settings and the notices offer "Sign in
      // again". `signOut` below is the only way back to the phone log.
      if (event === "SIGNED_OUT" && navigator.onLine) finishPasswordRecovery();
      update(s?.user ?? null);
    });
    supabase.auth
      .getSession()
      .then(({ data }) => update(data.session?.user ?? null))
      .catch(() => setReady(true));
    return () => {
      active = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);
  const signOut = async () => {
    await supabase?.auth.signOut({ scope: "local" });
    local.removeItem(storageKeys.account);
    setUser(null);
    setAccount(PHONE_ACCOUNT);
    finishPasswordRecovery();
  };
  const deleteAccount = async () => {
    if (!user || !supabase || !navigator.onLine)
      throw Error(t("err.deleteOffline"));
    const id = user.id;
    const { data, error } = await supabase.functions.invoke("delete-account", {
      // The server's fixed protocol word, whatever word the sheet asked for.
      body: { confirmation: "DELETE" },
    });
    if (error || !data?.deleted) throw Error(t("err.deleteFailed"));
    try {
      await eraseAccount(id);
    } finally {
      await signOut();
    }
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        account,
        ready,
        passwordRecovery,
        recoveredSession: recoveredSessionMatches(recoveryUserId, user?.id),
        finishPasswordRecovery,
        signOut,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
