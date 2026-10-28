import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { createElement, type ElementType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as calendar from "../src/lib/history-calendar";
import * as dates from "../src/lib/dates";
import * as labels from "../src/lib/labels";
import * as summary from "../src/data/summary";
import * as model from "../src/data/model";
import * as drops from "../src/data/drops";
import * as workouts from "../src/data/workouts";
import * as analytics from "../src/data/analytics";
import * as presentation from "../src/lib/progressPresentation";
import { StaticRouter } from "react-router-dom/server";

// Real React server rendering verifies markup without installing a DOM runtime.
// Browser layout, focus movement and device touch behavior are verified separately.
async function component(path: string, aliases: Record<string, unknown> = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const require = createRequire(import.meta.url);
  const exports: { default?: ElementType } = {};
  runInNewContext(compiled.outputText, {
    exports,
    require: (id: string) =>
      id.endsWith(".css")
        ? {}
        : ({
            "@/lib/history-calendar": calendar,
            "@/lib/dates": dates,
            "@/lib/labels": labels,
            "@/data/summary": summary,
            "@/data/model": model,
            ...aliases,
          }[id] ?? require(id)),
  });
  return exports.default!;
}

function workout(
  date: string,
  duration: number | null = 30,
  status: model.Workout["status"] = "completed",
  deleted = false,
): model.RecordDoc {
  return {
    id: date + duration + status,
    kind: "workout",
    revision: 1,
    localVersion: 1,
    dirty: false,
    deleted,
    payload: {
      name: "Workout",
      date,
      duration,
      status,
      startedAt: null,
      exercises: [],
    },
  };
}

test("simple calendar renders exactly the month's squares, accessible dates and workout markers", async () => {
  const Calendar = await component("../src/components/HistoryCalendar.tsx");
  const html = renderToStaticMarkup(
    createElement(Calendar, {
      value: {
        ...calendar.createHistoryCalendar("2024-03-02"),
        month: "2024-02",
        display: "simple",
      },
      now: "2024-03-02",
      records: [workout("2024-02-29"), workout("2024-02-28", 30, "draft")],
      onChange: () => {},
    }),
  );
  assert.equal((html.match(/class="calendar-day(?: |")/g) ?? []).length, 29);
  const dayButtons =
    html.match(/<button[^>]*class="calendar-day[^>]*>[\s\S]*?<\/button>/g) ??
    [];
  assert.equal(
    dayButtons.filter((day) =>
      day.includes('class="calendar-square is-filled"'),
    ).length,
    1,
  );
  assert.match(
    html,
    /aria-label="[^"]*(?:29 February|February 29)[^"]*2024[^"]*1 workout/,
  );
  assert.match(html, /aria-label="Simple view" aria-pressed="true"/);
  assert.equal((html.match(/class="calendar-icon-toggle"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /class="calendar-toggle"/);
  assert.doesNotMatch(html, /outside-month|calendar-weekdays/);
});

test("detailed calendar exposes future guards, a current-date label and one keyboard entry point", async () => {
  const Calendar = await component("../src/components/HistoryCalendar.tsx");
  const html = renderToStaticMarkup(
    createElement(Calendar, {
      value: calendar.createHistoryCalendar("2026-10-26"),
      now: "2026-10-26",
      records: [],
      onChange: () => {},
    }),
  );
  assert.match(html, /calendar-weekdays/);
  assert.match(html, /aria-current="date"/);
  const days = html.match(/<button[^>]*class="calendar-day[^>]*>/g) ?? [];
  assert.equal(days.filter((day) => day.includes('tabindex="0"')).length, 1);
  const future = days.find((day) => /(?:27 October|October 27)/.test(day));
  assert.match(future ?? "", /disabled=""/);
});

test("range calendar exposes chosen bounds and the active boundary without another date picker", async () => {
  const Calendar = await component("../src/components/HistoryCalendar.tsx");
  const html = renderToStaticMarkup(
    createElement(Calendar, {
      value: {
        ...calendar.createHistoryCalendar("2026-10-26"),
        mode: "range",
        month: "2026-09",
        from: "2026-09-29",
        to: "2026-10-10",
        activeBound: "to",
      },
      now: "2026-10-26",
      records: [],
      onChange: () => {},
    }),
  );
  assert.match(html, /aria-label="Choose From date[^"]*2026"/);
  assert.match(
    html,
    /aria-label="Choose To date[^"]*2026" aria-pressed="true"/,
  );
  assert.match(html, /dateTime="2026-09-29"/i);
  assert.match(html, /dateTime="2026-10-10"/i);
  assert.match(html, /is-range-start/);
  assert.match(html, /calendar-days calendar-range/);
  assert.match(html, /range-row-start/);
  assert.match(html, /range-row-end/);
  assert.equal((html.match(/>Show current month<\/button>/g) ?? []).length, 1);
  assert.doesNotMatch(html, />Whole month<|>This month<|>Clear dates</);
  assert.doesNotMatch(html, /type="date"|More periods/);
});

test("the default calendar has two icon toggles and no redundant reset action", async () => {
  const Calendar = await component("../src/components/HistoryCalendar.tsx");
  const html = renderToStaticMarkup(
    createElement(Calendar, {
      value: calendar.createHistoryCalendar("2026-10-26"),
      now: "2026-10-26",
      records: [],
      onChange() {},
    }),
  );
  assert.equal((html.match(/class="calendar-icon-toggle"/g) ?? []).length, 2);
  assert.match(html, /aria-label="Date range" aria-pressed="false"/);
  assert.match(html, /aria-label="Simple view" aria-pressed="false"/);
  assert.doesNotMatch(html, />Show current month<|>Whole month<|>This month</);
});

test("recent summary uses an inclusive 30-day window and an explicit preceding comparison", async () => {
  const Summary = await component("../src/components/ProgressSummary.tsx");
  const html = renderToStaticMarkup(
    createElement(Summary, {
      now: "2026-10-26",
      records: [
        workout("2026-09-27", 20),
        workout("2026-10-26", 40),
        workout("2026-09-26", 10),
        workout("2026-08-28", 10),
        workout("2026-10-27", 999),
        workout("2026-10-25", 999, "draft"),
        workout("2026-10-24", 999, "completed", true),
      ],
    }),
  );
  assert.match(html, /Last 30 days/);
  for (const date of ["2026-09-27", "2026-10-26", "2026-08-28", "2026-09-26"])
    assert.match(html, new RegExp(`dateTime="${date}"`, "i"));
  assert.match(html, /Avg duration · min<\/span><strong>30<\/strong>/);
  assert.match(html, /About these stats/);
});

test("History places its only calendar before current-month workouts and removes general stats", async () => {
  const Calendar = await component("../src/components/HistoryCalendar.tsx");
  const records = [workout("2026-10-26"), workout("2026-09-26")];
  (records[0].payload as model.Workout).name = "Current session";
  (records[1].payload as model.Workout).name = "Previous month session";
  // ConfirmDialog renders through Sheet, which this loader must compile too.
  const Sheet = await component("../src/components/ui/Sheet.tsx");
  const ConfirmDialog = await component("../src/components/ConfirmDialog.tsx", {
    "@/components/ui/Sheet": { default: Sheet },
  });
  const HistorySetList = await component(
    "../src/components/HistorySetList.tsx",
    { "@/data/drops": drops },
  );
  const History = await component("../src/pages/History.tsx", {
    "@/components/HistoryCalendar": { default: Calendar },
    "@/components/HistorySetList": { default: HistorySetList },
    "@/components/ConfirmDialog": { default: ConfirmDialog },
    "@/contexts/useData": {
      useData: () => ({
        state: {
          records: Object.fromEntries(
            records.map((record) => [record.id, record]),
          ),
        },
        save: async () => {},
        restoreWorkout: async () => {},
      }),
    },
    "@/hooks/useStartWorkout": {
      useStartWorkout: () => ({
        busy: false,
        confirmation: null,
        start: async () => {},
      }),
    },
    "@/data/model": { ...model, today: () => "2026-10-26" },
    "@/data/workouts": workouts,
  });
  const html = renderToStaticMarkup(
    createElement(
      StaticRouter,
      { location: "/history" },
      createElement(History),
    ),
  );
  assert.equal((html.match(/aria-label="Workout calendar"/g) ?? []).length, 1);
  assert.ok(
    html.indexOf('aria-label="Workout calendar"') <
      html.indexOf("Current session"),
  );
  assert.doesNotMatch(
    html,
    /Previous month session|More periods|About these stats|Workouts \/ active week/,
  );
});

test("Progress keeps the recent summary and the existing exercise results together", async () => {
  const Summary = await component("../src/components/ProgressSummary.tsx");
  const record = workout("2026-10-26");
  (record.payload as model.Workout).exercises = [
    {
      id: "exercise",
      exerciseId: "bench",
      name: "Bench press",
      sets: [{ ...model.newSet(), done: true, weight: 60, reps: 8 }],
    },
  ];
  const Progress = await component("../src/pages/Progress.tsx", {
    "@/components/ProgressSummary": { default: Summary },
    "@/contexts/useData": {
      useData: () => ({ state: { records: { [record.id]: record } } }),
    },
    "@/data/analytics": analytics,
    "@/lib/progressPresentation": presentation,
    "@/data/model": { ...model, today: () => "2026-10-26" },
  });
  const html = renderToStaticMarkup(
    createElement(
      StaticRouter,
      { location: "/progress" },
      createElement(Progress),
    ),
  );
  assert.match(html, /Last 30 days/);
  assert.match(html, /Workouts \/ active week/);
  assert.match(html, /Bench press/);
  assert.match(html, /Best working set/);
  assert.match(html, /href="\/history\?workout=/);
});

test("History details number only checked sets and show a drop under its set", async () => {
  const SetList = await component("../src/components/HistorySetList.tsx", {
    "@/data/drops": drops,
  });
  const set = (values: Partial<model.WorkoutSet> = {}): model.WorkoutSet => ({
    ...model.newSet(),
    weight: 100,
    reps: 5,
    done: true,
    ...values,
  });
  const html = renderToStaticMarkup(
    createElement(SetList, {
      sets: [
        set({ section: "warmup", weight: 40, reps: 8 }),
        set(),
        set({ weight: 80, reps: 4, drop: true }),
        set({ done: false, weight: 90 }),
        set({ weight: 105, reps: 3 }),
        set({ weight: 20, reps: 12, section: "winddown" }),
      ],
    }),
  );
  assert.match(html, /Set 1 · Warm-up<\/span><strong>40 kg × 8</);
  assert.match(html, /Set 2<\/span><strong>100 kg × 5</);
  assert.match(html, /<strong>↳ 80 kg × 4<\/strong>/);
  assert.ok(html.indexOf("↳ 80 kg × 4") > html.indexOf("100 kg × 5"));
  assert.ok(html.indexOf("↳ 80 kg × 4") < html.indexOf("105 kg × 3"));
  assert.match(html, /Set 3<\/span><strong>105 kg × 3</);
  assert.match(html, /Set 4 · Cool-down<\/span><strong>20 kg × 12</);
  assert.doesNotMatch(html, /Set 5|90 kg/);
  assert.equal(
    (html.match(/class="history-set(?: history-drop)?"/g) ?? []).length,
    5,
  );
  assert.equal(
    (html.match(/class="history-set history-drop"/g) ?? []).length,
    1,
  );
  assert.doesNotMatch(html, /Set \d+<\/span><strong>80 kg/);
});
