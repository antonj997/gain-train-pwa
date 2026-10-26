import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { eraseAccount } from "@/data/database";
import { local, session, storageKeys, writeStored } from "@/lib/storage";
import {
  RECOVERY_STORAGE_KEY,
  RECOVERY_USER_KEY,
  recoveryRequested,
  recoveredSessionMatches,
} from "@/lib/authRecovery";
type Auth = {
  user: User | null;
  account: string;
  ready: boolean;
  passwordRecovery: boolean;
  recoveredSession: boolean;
  finishPasswordRecovery: () => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [account, setAccount] = useState(
      () => local.getItem(storageKeys.account) || "phone",
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
      if (u) {
        writeStored(storageKeys.account, u.id);
        setAccount(u.id);
      }
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
      if (event === "SIGNED_OUT" && navigator.onLine) {
        local.removeItem(storageKeys.account);
        setAccount("phone");
        finishPasswordRecovery();
      }
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
    setAccount("phone");
    finishPasswordRecovery();
  };
  const deleteAccount = async () => {
    if (!user || !supabase || !navigator.onLine)
      throw Error(
        "Connect to the internet and sign in to delete your account.",
      );
    const id = user.id;
    const { data, error } = await supabase.functions.invoke("delete-account", {
      body: { confirmation: "DELETE" },
    });
    if (error || !data?.deleted)
      throw Error(
        "Could not delete your account. Sign in again and retry. Your account may still exist.",
      );
    try {
      await eraseAccount(id);
    } finally {
      await signOut();
    }
  };
  return (
    <Context.Provider
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
    </Context.Provider>
  );
}
export function useAuth() {
  const c = useContext(Context);
  if (!c) throw Error("Auth provider missing");
  return c;
}
