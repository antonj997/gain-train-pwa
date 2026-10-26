import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";

export type Auth = {
  user: User | null;
  account: string;
  ready: boolean;
  passwordRecovery: boolean;
  recoveredSession: boolean;
  finishPasswordRecovery: () => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};
export const AuthContext = createContext<Auth | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw Error("Auth provider missing");
  return context;
}
