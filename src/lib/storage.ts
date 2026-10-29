export type KeyValueStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

// Safari and privacy settings can throw on any storage access, including reading
// the global itself. Reads and removals fall back quietly so the app still opens;
// writes still throw so callers can tell the user an entry was not retained.
function guarded(get: () => Storage): KeyValueStorage {
  return {
    getItem(key) {
      try {
        return get().getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      get().setItem(key, value);
    },
    removeItem(key) {
      try {
        get().removeItem(key);
      } catch {
        /* Nothing stored to remove. */
      }
    },
  };
}

export const local = guarded(() => globalThis.localStorage);
export const session = guarded(() => globalThis.sessionStorage);

/** Writes a value, or removes it for null. Returns false when storage refused. */
export function writeStored(
  key: string,
  value: string | null,
  storage: KeyValueStorage = local,
) {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export const storageKeys = {
  account: "gt-account",
  theme: "gain-train-theme",
  /** "en" or "sv"; absent until this device has chosen. */
  language: "gt-language",
  restSeconds: "gt-rest-seconds",
  haptics: "gt-haptics",
  weeklyGoal: "gt-weekly-goal",
  persistRequested: "gt-persist-requested",
  /** This device closed Train's "Sign in to sync" banner. */
  signInBannerDismissed: "gt-sign-in-banner-dismissed",
  deleted: (account: string) => "gt-deleted-" + account,
  syncHealth: (account: string) => "gt-sync-health:" + account,
  /** The device-only plan of the earlier version; imported once, then removed. */
  legacyPlan: (account: string) => "gt-plan:" + account,
  legacyRemembered: ["rememberedPassword", "rememberedEmail"],
};

/** Every key in local storage, or none when storage is unavailable. */
export function storedKeys() {
  try {
    const storage = globalThis.localStorage;
    return Array.from({ length: storage.length }, (_, i) => storage.key(i)!);
  } catch {
    return [];
  }
}
