import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/useAuth";
import {
  motionScale,
  readSlowMotion,
  subscribeMotionScale,
  subscribeSlowMotionSetting,
  writeSlowMotion,
  type SlowMotionScale,
} from "@/lib/slow-motion";

const subscribeSetting = (listener: () => void) => {
  const stop = subscribeSlowMotionSetting(listener);
  // Another tab of the app changed it.
  window.addEventListener("storage", listener);
  return () => {
    stop();
    window.removeEventListener("storage", listener);
  };
};

/** The signed-in account's id, or "" signed out (as useAdmin decides it). */
export function useSignedInId() {
  const { user, account } = useAuth();
  return user && account === user.id ? user.id : "";
}

/** The signed-in account's stored slow-motion choice, and a setter. */
export function useSlowMotionSetting() {
  const userId = useSignedInId();
  const stored = useSyncExternalStore(subscribeSetting, () =>
    readSlowMotion(userId),
  );
  const set = useCallback(
    (scale: SlowMotionScale) => writeSlowMotion(userId, scale),
    [userId],
  );
  return { userId, stored, set };
}

/** The slow-motion scale in effect right now (1 when off). */
export function useMotionScale() {
  return useSyncExternalStore(subscribeMotionScale, motionScale);
}
