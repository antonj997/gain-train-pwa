import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  goalStreak,
  weekHeading,
  weekLegend,
  weekStrip,
  weekTotals,
} from "../src/lib/week-summary.ts";
import { setCurrentLanguage, t } from "../src/i18n/index.ts";
import { loadComponent } from "./helpers/render";
import {
  normalizeTrainingPreferences,
  parseWeeklyGoal,
} from "../src/lib/preferences.ts";
import { durationLabel } from "../src/lib/labels.ts";

test("week strip counts the workouts of each day", () => {
  const strip = weekStrip(
    ["2026-10-26", "2026-10-26", "2026-10-28"],
    "2026-10-28",
  );
  assert.deepEqual(
    strip.map((d) => d.count),
    [2, 0, 1, 0, 0, 0, 0],
  );
});

test("week strip runs Monday to Sunday and marks done days and today", () => {
  // 2026-10-28 is a Wednesday.
  const strip = weekStrip(
    ["2026-10-26", "2026-10-28", "2026-10-20"],
    "2026-10-28",
  );
  assert.deepEqual(
    strip.map((d) => d.date),
    [
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ],
  );
  assert.deepEqual(
    strip.map((d) => d.done),
    [true, false, true, false, false, false, false],
  );
  assert.deepEqual(
    strip.map((d) => d.today),
    [false, false, true, false, false, false, false],
  );
  assert.equal(strip[6].day, 1);
  assert.equal(strip[0].label, "M");
});

test("week totals count only this week's workouts", () => {
  const set = { id: "s", reps: 5, weight: 20, done: true } as never;
  const workout = (date: string, duration: number | null) => ({
    date,
    duration,
    exercises: [{ id: "e", sets: [set, set] }] as never,
  });
  const totals = weekTotals(
    [
      workout("2026-10-26", 60),
      workout("2026-10-25", 30),
      workout("2026-10-28", null),
    ],
    "2026-10-28",
  );
  assert.equal(totals.workouts, 2);
  assert.equal(totals.minutes, 60);
  assert.equal(totals.sets, totals.workouts * 2);
});

test("goal streak counts finished weeks that met the goal", () => {
  const week = (monday: string, n: number) =>
    Array.from({ length: n }, () => monday);
  const dates = [
    ...week("2026-10-26", 1), // this week, 1 so far
    ...week("2026-10-19", 3),
    ...week("2026-10-12", 4),
    ...week("2026-10-05", 2), // missed
    ...week("2026-09-28", 3),
  ];
  assert.equal(goalStreak(dates, 3, "2026-10-28"), 2);
  // The current week joins once it reaches the goal.
  assert.equal(
    goalStreak([...dates, "2026-10-27", "2026-10-28"], 3, "2026-10-28"),
    3,
  );
  assert.equal(goalStreak(dates, null, "2026-10-28"), 0);
  assert.equal(goalStreak([], 3, "2026-10-28"), 0);
});

test("weekly goal parsing accepts 1-14 and treats everything else as off", () => {
  assert.equal(parseWeeklyGoal("3"), 3);
  assert.equal(parseWeeklyGoal("14"), 14);
  for (const bad of [null, "", "0", "15", "-1", "2.5", "abc"])
    assert.equal(parseWeeklyGoal(bad), null);
  assert.equal(normalizeTrainingPreferences("60", "false", "4").weeklyGoal, 4);
});

test("time trained reads in minutes and hours", () => {
  assert.equal(durationLabel(0), "<1 min");
  assert.equal(durationLabel(45), "45 min");
  assert.equal(durationLabel(113), "1 h 53 min");
  assert.equal(durationLabel(120), "2 h");
});

test("the week card's head is one week reference: Den här veckan · 1 av 3 pass", () => {
  setCurrentLanguage("sv");
  try {
    assert.equal(
      weekHeading({ match: { matched: 1, planned: 3 }, goal: 3, workouts: 2 }),
      "Den här veckan · 1 av 3 pass",
    );
    // No plan: the weekly goal, then just the count.
    assert.equal(
      weekHeading({ match: null, goal: 4, workouts: 2 }),
      "Den här veckan · 2 av 4 pass",
    );
    assert.equal(
      weekHeading({ match: null, goal: null, workouts: 1 }),
      "Den här veckan · 1 pass",
    );
  } finally {
    setCurrentLanguage("en");
  }
  assert.equal(
    weekHeading({ match: { matched: 1, planned: 3 }, goal: null, workouts: 1 }),
    "This week · 1 of 3 workouts",
  );
});

test("the legend says where a moved workout came from: Flyttat hit från mån", () => {
  setCurrentLanguage("sv");
  try {
    const legend = weekLegend([{}, { movedFrom: "2026-11-16" }, {}]);
    assert.equal(legend.moved, "mån");
    assert.equal(
      t("week.legendMoved", { day: legend.moved! }),
      "Flyttat hit från mån",
    );
    assert.deepEqual(weekLegend([{}, {}]), {});
  } finally {
    setCurrentLanguage("en");
  }
});

test("the routine badge renders no number", async () => {
  const RoutineBadge = await loadComponent(
    "@/components/items/RoutineBadge.tsx",
  );
  const html = renderToStaticMarkup(
    createElement(RoutineBadge, {
      exercises: [
        { exerciseId: "builtin:squat" },
        { exerciseId: "builtin:lunge" },
      ],
    }),
  );
  assert.match(html, /class="routine-badge"/);
  assert.doesNotMatch(html, /routine-badge-count/);
  assert.doesNotMatch(html, />2</);
});
