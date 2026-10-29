// English, the default language and the source of truth for message keys.
// sv.ts must hold exactly the same keys (checked by `satisfies Messages`).
// `{name}` is replaced by a parameter; { one, other } picks by `{count}`.
export const en = {
  // App
  "app.documentTitle": "Gain Train — Workout Log",
  "app.opening": "Opening…",
  "app.openingLog": "Opening your workout log…",
  "app.offlineReady": "Ready to log offline",
  "app.updateReady": "An app update is ready.",
  "app.update": "Update",
  "nav.main": "Main navigation",
  "nav.train": "Train",
  "nav.history": "History",
  "nav.progress": "Progress",
  "nav.library": "Library",

  // Language
  "language.title": "Language",

  // Counts
  "count.set": { one: "{count} set", other: "{count} sets" },
  "count.completedSet": {
    one: "{count} completed set",
    other: "{count} completed sets",
  },
  "count.uncheckedSet": {
    one: "{count} unchecked set",
    other: "{count} unchecked sets",
  },
  "count.workout": { one: "{count} workout", other: "{count} workouts" },
  "count.drop": { one: "{count} drop", other: "{count} drops" },
  "count.exercise": { one: "{count} exercise", other: "{count} exercises" },
  "count.routine": { one: "{count} routine", other: "{count} routines" },
  "count.session": { one: "{count} session", other: "{count} sessions" },
  "count.day": { one: "{count} day", other: "{count} days" },

  // Durations
  "duration.underMinute": "<1 min",
  "duration.minutes": "{m} min",
  "duration.hours": "{h} h",
  "duration.hoursMinutes": "{h} h {m} min",

  // Finish summary
  "finish.atLeastOne": "Complete at least one set",
  "finish.willBeSaved": "{sets} will be saved",
  "finish.leftOut": "{saved} · {unchecked} left out",

  // Common
  "common.back": "Back",
  "common.done": "Done",
  "common.off": "Off",
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.save": "Save",
  "common.saving": "Saving…",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.start": "Start",
  "common.retry": "Retry",
  "common.undo": "Undo",
  "common.today": "today",
  "common.todayCap": "Today",
  "common.kg": "{value} kg",

  // Settings
  "settings.title": "Settings",
  "settings.signedInSyncing": "Signed in · syncing…",
  "settings.signedInPending": "Signed in · {count} pending",
  "settings.signedInSynced": "Signed in · synced",
  "settings.phoneSignIn": "Saved on this phone · sign in to sync",
  "settings.phoneSignInAgain": "Saved on this phone · sign in again to sync",
  "settings.notSignedIn": "Not signed in",
  "settings.training": "Training",
  "settings.bodyweight": "Bodyweight",
  "settings.notSet": "Not set",
  "settings.weeklyGoal": "Weekly goal",
  "settings.restTimer": "Rest timer",
  "settings.theme": "Theme",
  "settings.dark": "Dark",
  "settings.light": "Light",
  "settings.account": "Account",
  "settings.signOut": "Sign out",
  "settings.signOutFailed": "Could not sign out. Try again.",
  "settings.deleteAccount": "Delete account",
  "settings.signInAgain": "Sign in again",
  "settings.usePhoneLog": "Use this phone's own log instead",
  "settings.switchFailed": "Could not switch logs. Try again.",
  "settings.noteSignedIn":
    "Sync runs when connected while the app is open, and when you return. Your phone keeps a local copy.",
  "settings.noteSessionEnded":
    "Your session ended, so this account's log is not syncing. It stays on this phone; sign in again to sync it.",
  "settings.notePhone":
    "An account is optional. Sign in to sync across devices; your phone-only log stays separate until you choose to copy it.",
  "settings.goalDescription":
    "How many workouts you aim for each week, Monday to Sunday.",
  "settings.setGoal": "Set a weekly goal",
  "settings.fewerWorkout": "One fewer workout",
  "settings.moreWorkout": "One more workout",
  "settings.perWeekUnit": { one: "workout a week", other: "workouts a week" },
  "settings.restDescription": "Starts after checking a set as done.",
  "settings.restTime": "Rest time",
  "settings.vibrate": "Vibrate when a set is done",
  "settings.vibrateNote":
    "Vibration is off by default and works on supported devices.",
  "settings.lightAppearance": "Light appearance",
};
