import { createContext, useContext } from "react";
import type { Profile, ProfileSnapshot } from "@/lib/profile";

export type ProfileContextValue = ProfileSnapshot & {
  saveProfile: (profile: Profile) => void;
  retrySync: () => void;
};
export const ProfileContext = createContext<ProfileContextValue | null>(null);

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("Profile provider missing");
  return context;
}
