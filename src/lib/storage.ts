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
  restSeconds: "gt-rest-seconds",
  haptics: "gt-haptics",
  persistRequested: "gt-persist-requested",
  deleted: (account: string) => "gt-deleted-" + account,
  syncHealth: (account: string) => "gt-sync-health:" + account,
  legacyRemembered: ["rememberedPassword", "rememberedEmail"],
};
