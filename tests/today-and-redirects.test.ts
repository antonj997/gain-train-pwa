import test from "node:test";
import assert from "node:assert/strict";
import {
  lastDoneByRoutine,
  leastRecent,
  todayPick,
} from "../src/data/today.ts";
import type { PlannedDay } from "../src/data/plans.ts";
import { legacyRedirect } from "../src/lib/legacy-routes.ts";
import {
  LIBRARY_TABS,
  ROUTINE_VIEWS,
  libraryTabOf,
  routinesViewOf,
} from "../src/lib/library-tabs.ts";
import { setCurrentLanguage, t } from "../src/i18n/index.ts";

const done = (entries: Record<string, string>) =>
  new Map(Object.entries(entries));
const day = (
  kind: PlannedDay["kind"],
  extra: Partial<PlannedDay> = {},
): PlannedDay => ({
  kind,
  title: kind,
  routineIds: [],
  categories: [],
  ...extra,
});

test("the suggestion is the routine done least recently", () => {
  assert.deepEqual(
    leastRecent(
      ["a", "b", "c"],
      done({ a: "2026-11-05", b: "2026-11-02", c: "2026-11-06" }),
    ),
    { routineId: "b", reason: "rotation" },
  );
  // Ties keep the saved order.
  assert.deepEqual(
    leastRecent(["a", "b"], done({ a: "2026-11-02", b: "2026-11-02" })),
    { routineId: "a", reason: "rotation" },
  );
});

test("routines never done are left out, unless nothing has been done yet", () => {
  assert.deepEqual(leastRecent(["new", "a"], done({ a: "2026-11-05" })), {
    routineId: "a",
    reason: "rotation",
  });
  assert.deepEqual(leastRecent(["x", "y"], done({})), {
    routineId: "x",
    reason: "first",
  });
  assert.equal(leastRecent([], done({ a: "2026-11-05" })), null);
});

test("a planned routine, day type or group comes first", () => {
  const routine = day("routine", { routineIds: ["r"] });
  assert.deepEqual(todayPick(routine, ["a", "r"], done({ a: "2026-01-01" })), {
    kind: "planned",
    day: routine,
    routineId: "r",
  });
  const type = day("type", { categories: ["Legs"] });
  assert.deepEqual(todayPick(type, ["a"], done({})), {
    kind: "planned",
    day: type,
    routineId: null,
  });
  // A group starts its least recently done routine.
  const group = day("group", { routineIds: ["g1", "g2"] });
  assert.deepEqual(
    todayPick(group, ["a"], done({ g1: "2026-11-05", g2: "2026-11-01" })),
    { kind: "planned", day: group, routineId: "g2" },
  );
  // A group whose routines are gone starts with its categories' suggestions.
  const empty = day("group", { categories: ["Back"] });
  assert.deepEqual(todayPick(empty, ["a"], done({})), {
    kind: "planned",
    day: empty,
    routineId: null,
  });
});

test("nothing planned or a rest day suggests a routine; without routines there is nothing", () => {
  const lastDone = done({ a: "2026-11-05", b: "2026-11-01" });
  assert.deepEqual(todayPick(null, ["a", "b"], lastDone), {
    kind: "suggested",
    routineId: "b",
    reason: "rotation",
    rest: false,
  });
  assert.deepEqual(todayPick(day("rest"), ["a", "b"], lastDone), {
    kind: "suggested",
    routineId: "b",
    reason: "rotation",
    rest: true,
  });
  assert.deepEqual(todayPick(null, [], lastDone), {
    kind: "none",
    rest: false,
  });
  assert.deepEqual(todayPick(day("rest"), [], lastDone), {
    kind: "none",
    rest: true,
  });
});

test("last done keeps each routine's newest date, in any order", () => {
  const dates = lastDoneByRoutine([
    { payload: { routineId: "a", date: "2026-11-01" } },
    { payload: { routineId: "a", date: "2026-11-05" } },
    { payload: { routineId: null, date: "2026-11-06" } },
    { payload: { date: "2026-11-06" } },
    { payload: { routineId: "b", date: "2026-10-30" } },
  ]);
  assert.deepEqual(
    [...dates],
    [
      ["a", "2026-11-05"],
      ["b", "2026-10-30"],
    ],
  );
});

test("old tab links redirect to the subscreens", () => {
  assert.equal(legacyRedirect("/progress", "?tab=goals"), "/progress/goals");
  assert.equal(legacyRedirect("/progress/", "?tab=goals"), "/progress/goals");
  assert.equal(legacyRedirect("/progress", "?tab=stats"), "/progress");
  assert.equal(legacyRedirect("/library", "?tab=plan"), "/library?tab=plans");
  assert.equal(
    legacyRedirect("/library", "?view=shared"),
    "/library?view=discover",
  );
  assert.equal(
    legacyRedirect("/library", "?tab=shared"),
    "/library?view=discover",
  );
  assert.equal(legacyRedirect("/library/shared", ""), "/library?view=discover");
  assert.equal(
    legacyRedirect("/library/shared/", "?shared=abc"),
    "/library?shared=abc&view=discover",
  );
  assert.equal(
    legacyRedirect("/library", "?tab=routines&view=shared"),
    "/library?view=discover",
  );
  assert.equal(legacyRedirect("/library", "?tab=routines"), "/library");
  assert.equal(legacyRedirect("/routines", ""), "/library");
  assert.equal(legacyRedirect("/my-exercises", ""), "/library?tab=exercises");
});

test("redirects keep other parameters", () => {
  assert.equal(
    legacyRedirect("/library", "?tab=routines&edit=abc"),
    "/library?edit=abc",
  );
  assert.equal(
    legacyRedirect("/progress", "?tab=goals&x=1"),
    "/progress/goals?x=1",
  );
  assert.equal(legacyRedirect("/routines", "?edit=abc"), "/library?edit=abc");
});

test("current URLs are left alone", () => {
  for (const [path, search] of [
    ["/", ""],
    ["/", "?start=workout"],
    ["/history", "?workout=w1&set=s1"],
    ["/progress", ""],
    ["/progress/goals", ""],
    ["/library", ""],
    ["/library", "?tab=exercises"],
    ["/library", "?tab=exercises&edit=x"],
    ["/library", "?edit=abc"],
    ["/library", "?tab=exercises&view=shared"],
    ["/library/plan/p1", ""],
    ["/library", "?tab=plans"],
    ["/library", "?tab=plans&new=plan&program=hk"],
    ["/library", "?view=discover"],
    ["/library", "?view=discover&shared=abc"],
    ["/settings", ""],
    ["/exercise/builtin%3Asquat", "?tab=history"],
  ])
    assert.equal(legacyRedirect(path, search), null, path + search);
});

// ---- v6 A1: first start (Task 2.4)

/** The component tests' Swedish `useT`, following the phone. */
const swedish = async (followsPhone = true) => {
  const { translate } = await import("../src/i18n");
  return {
    useT: () => ({
      language: "sv",
      locale: "sv-SE",
      followsPhone,
      t: (
        key: Parameters<typeof translate>[1],
        params?: Parameters<typeof translate>[2],
      ) => translate("sv", key, params),
    }),
  };
};

test("a new user sees Kör ditt första pass, three Kom igång rows and the language row", async () => {
  const router = await import("react-router-dom");
  const { default: React } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { loadModule } = await import("./helpers/render");
  const { FirstStartCard, GetStarted } = await loadModule<{
    FirstStartCard: React.FC<{ starting: boolean; onStartEmpty: () => void }>;
    GetStarted: React.FC;
  }>("@/components/home/GetStarted.tsx", {
    "react-router-dom": router,
    "@/i18n/useT": await swedish(),
  });
  const html = renderToStaticMarkup(
    React.createElement(
      router.MemoryRouter,
      null,
      React.createElement(FirstStartCard, {
        starting: false,
        onStartEmpty: () => {},
      }),
      React.createElement(GetStarted),
    ),
  );
  const text = html.replace(/<[^>]+>/g, "|");
  assert.match(text, /I dag · inget planerat/);
  assert.match(text, /Kör ditt första pass/);
  assert.match(
    text,
    /Lägg till övningar medan du tränar\. Allt sparas på mobilen, även utan konto\./,
  );
  assert.match(text, /Starta tomt pass/);
  assert.match(text, /Kom igång/);
  for (const [title, sub] of [
    ["Välj en färdig rutin", "Bibliotek → Upptäck"],
    ["Bygg en egen rutin", "Övningar och set du kör ofta"],
    ["Lägg upp ett schema", "Veckor, deload och mål"],
  ]) {
    assert.match(text, new RegExp(title));
    assert.match(text, new RegExp(sub));
  }
  assert.equal(html.match(/class="row get-started-row"/g)?.length, 3);
  assert.match(text, /Språk · Language/);
  assert.match(text, /Svenska, som telefonen/);
  // One way to an empty workout.
  assert.equal(text.match(/tomt pass/gi)?.length, 1);
  // The rows go to Upptäck, a new routine and a new plan.
  assert.match(html, /href="\/library\?view=discover"/);
  assert.match(html, /href="\/library\?new=routine"/);
  assert.match(html, /href="\/library\?tab=plans&amp;new=plan"/);
});

test("a chosen language reads without the phone note", async () => {
  const router = await import("react-router-dom");
  const { default: React } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { loadModule } = await import("./helpers/render");
  const { GetStarted } = await loadModule<{ GetStarted: React.FC }>(
    "@/components/home/GetStarted.tsx",
    { "react-router-dom": router, "@/i18n/useT": await swedish(false) },
  );
  const html = renderToStaticMarkup(
    React.createElement(
      router.MemoryRouter,
      null,
      React.createElement(GetStarted),
    ),
  );
  assert.match(html, />Svenska</);
  assert.doesNotMatch(html, /som telefonen/);
});

// ---- v6 A3: a workout is already running (Task 2.5)

test("the running-workout dialog names the workout and offers three choices in order", async () => {
  const { default: React } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { loadModule } = await import("./helpers/render");
  const { translate } = await import("../src/i18n");
  const sv = await swedish();
  type Choices = React.FC<{
    name: string;
    text: string;
    armed: boolean;
    busy: boolean;
    onContinue: () => void;
    onSaveRoutine: () => void;
    onDiscard: () => void;
  }>;
  const { default: RunningWorkoutChoices } = await loadModule<{
    default: Choices;
  }>("@/components/home/RunningWorkoutChoices.tsx", { "@/i18n/useT": sv });
  const { runningDialogText, discardTap } =
    await import("../src/lib/running-workout.ts");
  const svT = (key: never, params?: never) => translate("sv", key, params);
  const set = (done: boolean) => ({
    id: crypto.randomUUID(),
    reps: 8,
    weight: 40,
    load: "weight",
    section: "working",
    done,
  });
  const running = {
    name: "Bröst & Ben",
    exercises: [
      { id: "a", exerciseId: "x", name: "X", sets: [set(false), set(false)] },
      { id: "b", exerciseId: "y", name: "Y", sets: [set(false)] },
    ],
  };
  const { setCurrentLanguage } = await import("../src/i18n");
  setCurrentLanguage("sv");
  let text;
  try {
    text = runningDialogText(running, svT);
  } finally {
    setCurrentLanguage("en");
  }
  assert.equal(text.title, "Du har ett pass igång");
  assert.equal(text.sub, "Bröst & Ben · 2 övningar · 0 av 3 set");
  assert.equal(
    text.text,
    "Startar du ett nytt tomt pass slängs Bröst & Ben med sina övningar.",
  );
  const render = (armed: boolean) =>
    renderToStaticMarkup(
      React.createElement(RunningWorkoutChoices, {
        name: text.name,
        text: text.text,
        armed,
        busy: false,
        onContinue: () => {},
        onSaveRoutine: () => {},
        onDiscard: () => {},
      }),
    );
  const buttons = [...render(false).matchAll(/<button[^>]*>([^<]*)</g)].map(
    (m) => m[1],
  );
  assert.deepEqual(buttons, [
    "Fortsätt Bröst &amp; Ben",
    "Spara som rutin och avsluta",
    "Släng och starta nytt",
  ]);
  assert.match(render(false), /class="btn-primary btn-block"/);
  assert.match(render(false), /class="btn-secondary btn-block"/);
  assert.match(render(true), />Tryck igen för att slänga</);
  // Släng needs two taps: the first arms, a second within 3 s discards.
  assert.equal(discardTap(null, 1000), "arm");
  assert.equal(discardTap(1000, 2500), "confirm");
  assert.equal(discardTap(1000, 4500), "arm");
});

test("v6: Upptäck lives inside Rutiner, and Plan is the Scheman tab", () => {
  assert.equal(
    legacyRedirect("/library", "?tab=discover"),
    "/library?view=discover",
  );
  assert.equal(
    legacyRedirect("/library", "?tab=discover&shared=abc"),
    "/library?shared=abc&view=discover",
  );
  assert.equal(legacyRedirect("/library/plan", ""), "/library?tab=plans");
  assert.equal(legacyRedirect("/library/plan/", ""), "/library?tab=plans");
  // The plan status page stays.
  assert.equal(legacyRedirect("/library/plan/abc", ""), null);
});

test("v6: the Library tabs are Rutiner, Övningar and Scheman", () => {
  setCurrentLanguage("sv");
  try {
    assert.deepEqual(
      LIBRARY_TABS.map((tab) => t(tab.label)),
      ["Rutiner", "Övningar", "Scheman"],
    );
    assert.deepEqual(
      ROUTINE_VIEWS.map((view) => t(view.label)),
      ["Mina", "Upptäck"],
    );
  } finally {
    setCurrentLanguage("en");
  }
  assert.equal(libraryTabOf("plans"), "plans");
  assert.equal(libraryTabOf("exercises"), "exercises");
  assert.equal(libraryTabOf("discover"), "routines");
  assert.equal(libraryTabOf(null), "routines");
  assert.equal(routinesViewOf("discover"), "discover");
  assert.equal(routinesViewOf(null), "mine");
});
