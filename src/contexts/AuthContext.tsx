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
type Auth = {
  user: User | null;
  account: string;
  ready: boolean;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [account, setAccount] = useState(
      () => localStorage.getItem("gt-account") || "phone",
    ),
    [ready, setReady] = useState(false);
  useEffect(() => {
    localStorage.removeItem("rememberedPassword");
    localStorage.removeItem("rememberedEmail");
    if (!supabase) {
      setReady(true);
      return;
    }
    let active = true;
    const update = (u: User | null) => {
      if (!active) return;
      setUser(u);
      if (u) {
        localStorage.setItem("gt-account", u.id);
        setAccount(u.id);
      }
      setReady(true);
    };
    const timeout = setTimeout(() => setReady(true), 4000);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT" && navigator.onLine) {
        localStorage.removeItem("gt-account");
        setAccount("phone");
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
    localStorage.removeItem("gt-account");
    setUser(null);
    setAccount("phone");
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
    <Context.Provider value={{ user, account, ready, signOut, deleteAccount }}>
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const c = useContext(Context);
  if (!c) throw Error("Auth provider missing");
  return c;
}
