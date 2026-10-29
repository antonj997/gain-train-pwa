import type { Messages } from "./index";

// Swedish: casual du-form, short. Same keys as en.ts.
export const sv = {
  // App
  "app.documentTitle": "Gain Train — Träningslogg",
  "app.opening": "Öppnar…",
  "app.openingLog": "Öppnar din träningslogg…",
  "app.offlineReady": "Redo att logga offline",
  "app.updateReady": "En uppdatering av appen är klar.",
  "app.update": "Uppdatera",
  "nav.main": "Huvudmeny",
  "nav.train": "Träna",
  "nav.history": "Historik",
  "nav.progress": "Framsteg",
  "nav.library": "Bibliotek",

  // Language
  "language.title": "Språk",

  // Counts
  "count.set": { one: "{count} set", other: "{count} set" },
  "count.completedSet": {
    one: "{count} klart set",
    other: "{count} klara set",
  },
  "count.uncheckedSet": {
    one: "{count} okryssat set",
    other: "{count} okryssade set",
  },
  "count.workout": { one: "{count} pass", other: "{count} pass" },
  "count.drop": { one: "{count} drop", other: "{count} drop" },
  "count.exercise": { one: "{count} övning", other: "{count} övningar" },
  "count.routine": { one: "{count} rutin", other: "{count} rutiner" },
  "count.session": { one: "{count} pass", other: "{count} pass" },
  "count.day": { one: "{count} dag", other: "{count} dagar" },

  // Durations
  "duration.underMinute": "<1 min",
  "duration.minutes": "{m} min",
  "duration.hours": "{h} h",
  "duration.hoursMinutes": "{h} h {m} min",

  // Finish summary
  "finish.atLeastOne": "Kryssa i minst ett set",
  "finish.willBeSaved": "{sets} sparas",
  "finish.leftOut": "{saved} · {unchecked} tas inte med",

  // Common
  "common.back": "Tillbaka",
  "common.done": "Klar",
  "common.off": "Av",
  "common.cancel": "Avbryt",
  "common.close": "Stäng",
  "common.save": "Spara",
  "common.saving": "Sparar…",
  "common.delete": "Radera",
  "common.edit": "Redigera",
  "common.start": "Starta",
  "common.retry": "Försök igen",
  "common.undo": "Ångra",
  "common.today": "i dag",
  "common.todayCap": "I dag",
  "common.kg": "{value} kg",

  // Settings
  "settings.title": "Inställningar",
  "settings.signedInSyncing": "Inloggad · synkar…",
  "settings.signedInPending": "Inloggad · {count} väntar",
  "settings.signedInSynced": "Inloggad · synkad",
  "settings.phoneSignIn": "Sparat på den här mobilen · logga in för att synka",
  "settings.phoneSignInAgain":
    "Sparat på den här mobilen · logga in igen för att synka",
  "settings.notSignedIn": "Inte inloggad",
  "settings.training": "Träning",
  "settings.bodyweight": "Kroppsvikt",
  "settings.notSet": "Inte angiven",
  "settings.weeklyGoal": "Veckomål",
  "settings.restTimer": "Vilotimer",
  "settings.theme": "Tema",
  "settings.dark": "Mörkt",
  "settings.light": "Ljust",
  "settings.account": "Konto",
  "settings.signOut": "Logga ut",
  "settings.signOutFailed": "Kunde inte logga ut. Försök igen.",
  "settings.deleteAccount": "Radera konto",
  "settings.signInAgain": "Logga in igen",
  "settings.usePhoneLog": "Använd mobilens egen logg i stället",
  "settings.switchFailed": "Kunde inte byta logg. Försök igen.",
  "settings.noteSignedIn":
    "Synken körs när du är uppkopplad och appen är öppen, och när du kommer tillbaka. Mobilen sparar en lokal kopia.",
  "settings.noteSessionEnded":
    "Din session har gått ut, så kontots logg synkas inte. Den ligger kvar på mobilen; logga in igen för att synka den.",
  "settings.notePhone":
    "Ett konto är frivilligt. Logga in för att synka mellan enheter; mobilens egen logg hålls separat tills du väljer att kopiera den.",
  "settings.goalDescription":
    "Hur många pass du siktar på varje vecka, måndag till söndag.",
  "settings.setGoal": "Sätt ett veckomål",
  "settings.fewerWorkout": "Ett pass färre",
  "settings.moreWorkout": "Ett pass till",
  "settings.perWeekUnit": { one: "pass i veckan", other: "pass i veckan" },
  "settings.restDescription": "Startar när du kryssar i ett set.",
  "settings.restTime": "Vilotid",
  "settings.vibrate": "Vibrera när ett set är klart",
  "settings.vibrateNote":
    "Vibration är av som standard och fungerar på enheter som stöder det.",
  "settings.lightAppearance": "Ljust utseende",
} satisfies Messages;
