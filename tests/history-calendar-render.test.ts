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
import * as segmentedKeys from "../src/lib/segmented-keys";

// Real React server rendering verifies markup without installing a DOM runtime.
// Browser layout, focus movement and device touch behavior are verified separately.
// The calendar draws its display control with the shared Segmented component.
async function calendarComponent() {
  const Segmented = await component("../src/components/ui/Segmented.tsx", {
    "@/lib/segmented-keys": segmentedKeys,
  });
  return component("../src/components/HistoryCalendar.tsx", {
    "@/components/ui/Segmented": { default: Segmented },
  });
}

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
  const Calendar = await calendarComponent();
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
  assert.match(html, /role="radio" aria-checked="true"[^>]*>Simple</);
  assert.match(html, /role="radio" aria-checked="false"[^>]*>Detailed</);
  assert.doesNotMatch(html, /outside-month|calendar-weekdays/);
});

test("detailed calendar exposes future guards, a current-date label and one keyboard entry point", async () => {
  const Calendar = await calendarComponent();
  const html = renderToStaticMarkup(
    createElement(Calendar, {
      value: {
        ...calendar.createHistoryCalendar("2026-10-26"),
        display: "detailed",
      },
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
  const Calendar = await calendarComponent();
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

test("the default calendar is simple, with a display control, a range switch and no redundant reset action", async () => {
  const Calendar = await calendarComponent();
  const html = renderToStaticMarkup(
    createElement(Calendar, {
      value: calendar.createHistoryCalendar("2026-10-26"),
      now: "2026-10-26",
      records: [],
      onChange() {},
    }),
  );
  assert.match(html, /class="history-calendar calendar-simple"/);
  assert.match(html, /role="radiogroup" aria-label="Calendar display"/);
  assert.match(html, /role="radio" aria-checked="true"[^>]*>Simple</);
  assert.match(html, /aria-label="Date range" aria-pressed="false"/);
  // The month moves with 44px icon buttons.
  assert.match(html, /class="icon-btn" aria-label="Previous month"/);
  assert.match(html, /class="icon-btn" aria-label="Next month"/);
  assert.doesNotMatch(html, />Show current month<|>Whole month<|>This month</);
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
  assert.match(html, />Warm-up<\/span><strong>40 kg × 8</);
  assert.match(html, /Set 1<\/span><strong>100 kg × 5</);
  assert.match(html, /<strong>↳ 80 kg × 4<\/strong>/);
  assert.ok(html.indexOf("↳ 80 kg × 4") > html.indexOf("100 kg × 5"));
  assert.ok(html.indexOf("↳ 80 kg × 4") < html.indexOf("105 kg × 3"));
  assert.match(html, /Set 2<\/span><strong>105 kg × 3</);
  assert.match(html, />Cool-down<\/span><strong>20 kg × 12</);
  assert.doesNotMatch(html, /Set 3|90 kg/);
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
