import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useAuth } from "./useAuth";
import { ProfileContext } from "./useProfile";
import { supabase } from "@/integrations/supabase/client";
import { local } from "@/lib/storage";
import { ProfileStore, createProfileConnection } from "@/lib/profile";

export function ProfileProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const currentAuth = useRef(auth);
  currentAuth.current = auth;
  const [store] = useState(() => {
    const account = auth.account;
    const isCurrent = () =>
      currentAuth.current.account === account &&
      currentAuth.current.user?.id === account;
    return new ProfileStore({
      account,
      storage: local,
      metadata: auth.user?.id === account ? auth.user.user_metadata : undefined,
      canSync: () =>
        !!supabase &&
        currentAuth.current.ready &&
        isCurrent() &&
        navigator.onLine,
      connect: async (signal) => {
        // This effect-driven work runs after auth callbacks have returned.
        const { data, error } = await supabase!.auth.getSession();
        if (
          error ||
          !data.session ||
          data.session.user.id !== account ||
          !isCurrent()
        )
          throw new Error("Sign in again to sync your profile.");
        return createProfileConnection({
          account,
          token: data.session.access_token,
          url: import.meta.env.VITE_SUPABASE_URL,
          publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          signal,
          isCurrent,
        });
      },
    });
  });
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const metadata =
    auth.user?.id === auth.account ? auth.user.user_metadata : undefined;
  useEffect(() => {
    store.acceptMetadata(metadata);
  }, [store, metadata]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void store.sync();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [store, auth.ready, auth.user?.id]);
  useEffect(() => {
    const sync = () => {
      void store.sync();
    };
    const visible = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", visible);
      store.dispose();
    };
  }, [store]);
  return (
    <ProfileContext.Provider
      value={{
        ...snapshot,
        saveProfile: (profile) => {
          store.saveProfile(profile);
          void store.sync();
        },
        retrySync: () => {
          void store.sync();
        },
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}
