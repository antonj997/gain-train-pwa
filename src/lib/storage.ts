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
  /**
   * The rest time for every exercise without its own; 0 (v6) means each
   * exercise's tier. Before v6 a time above 0 meant the timer was on.
   */
  restSeconds: "gt-rest-seconds",
  /**
   * v6: "true" or "false" once the rest timer was switched; absent before
   * that, when a saved time above 0 reads as on (preferences.ts).
   */
  restOn: "gt-rest-on",
  /** v6: "false" when the Set sheet leaves out its warm-up and drop tips. */
  workoutTips: "gt-workout-tips",
  /** v6: "off" or "auto" for a tired muscle late in a workout; "suggest" otherwise. */
  fatigueMode: "gt-fatigue-mode",
  /** v6: the bar's weight in kg (20, 15 or 10) for the warm-up sheet's plates. */
  barKg: "gt-bar-kg",
  /** v6: the plates at hand for the warm-up sheet (its own format, P1). */
  plates: "gt-plates",
  /** The rest time to go back to when the rest timer is switched on again. */
  restLastSeconds: "gt-rest-last-seconds",
  haptics: "gt-haptics",
  /** "false" when the rest timer should stay silent; a sound plays otherwise. */
  restSound: "gt-rest-sound",
  /** "true" when a checked set offers reps in reserve; off otherwise. */
  askRir: "gt-ask-rir",
  /** "true" once a swipe has asked before deleting a checked set: it asks once per device. */
  checkedDeleteAsked: "gt-checked-delete-asked",
  /** "false" when a running workout lets the screen sleep; kept on otherwise. */
  keepScreenOn: "gt-keep-screen-on",
  weeklyGoal: "gt-weekly-goal",
  /** Library → Routines' order: "recent" (the default) or "name". */
  routineSort: "gt-routine-sort",
  /** "kg" or "lb"; weights are stored in kg either way. */
  weightUnit: "gt-weight-unit",
  persistRequested: "gt-persist-requested",
  /** The muscle maps' figure: "f" for the woman; the man otherwise. */
  mapFigure: "gt-map-figure",
  /** The chart metric an exercise's Overview was last left on ("top", "e1rm", ...). */
  exerciseMetric: (exerciseId: string) => "gt-exercise-metric:" + exerciseId,
  /** The last crash the error screen showed, offered with a bug report. */
  lastError: "gt-last-error",
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
