import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as model from "../src/data/model";
import { setBadge } from "../src/data/drops";
import { loadComponent } from "./helpers/render";

// Render the actual components with React's server renderer. No browser or
// cloud is substituted: this checks the control/validation markup, not visual
// layout.
async function setLine(props: Record<string, unknown>) {
  const SetLine = await loadComponent("../src/components/workout/SetLine.tsx");
  const set = props.set as model.WorkoutSet;
  return renderToStaticMarkup(
    createElement(SetLine, {
      name: "Bench Press",
      mode: "log",
      badge: setBadge([set], 0),
      marker: "none",
      canCheck: true,
      onOpenSheet: () => {},
      onChange: () => {},
      ...props,
    }),
  );
}

const tags = (html: string, name: string) =>
  html.match(new RegExp(`<${name}\\b[^>]*>`, "g")) ?? [];
const css = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

test("empty sets omit instructional prompts while completed values remain read-only", async () => {
  const empty = await setLine({ set: model.newSet() });
  assert.doesNotMatch(
    empty,
    /Enter reps to complete|Enter kg, or choose Bodyweight/,
  );
  const checked = await setLine({
    set: { ...model.newSet(), weight: 75, reps: 8, done: true },
  });
  assert.match(checked, /value="75"/);
  assert.match(checked, /value="8"/);
  assert.equal((checked.match(/readonly=""/g) ?? []).length, 2);
  assert.match(checked, /aria-label="Uncheck Bench Press set 1"/);
  assert.match(checked, /aria-pressed="true"/);
  const open = await setLine({ set: model.newSet() });
  assert.match(open, /aria-label="Complete Bench Press set 1"/);
  assert.match(open, /aria-pressed="false"/);
});

test("fields use the decimal and numeric keyboards", async () => {
  const html = await setLine({
    set: { ...model.newSet(), weight: 75, reps: 8 },
  });
  const [load, count] = tags(html, "input");
  assert.match(load, /inputMode="decimal"/);
  assert.match(count, /inputMode="numeric"/);
});

test("extra BW uses the regular weight field with an added-kilograms label", async () => {
  const html = await setLine({
    set: {
      ...model.newSet(),
      load: "bodyweight",
      extraWeight: true,
      weight: 12.5,
      reps: 8,
    },
    marker: "plus",
    bodyWeightKg: 80,
  });
  assert.match(html, /aria-label="Bench Press set 1 added kilograms"/);
  assert.match(html, /value="12.5"/);
  assert.equal(tags(html, "input").length, 2);
});

test("rows name their units and unfinished raw text remains visible", async () => {
  const reps = await setLine({
    set: { ...model.newSet(), weight: 75, reps: 8, done: true },
  });
  assert.match(reps, /aria-label="Bench Press set 1 kilograms"/);
  assert.match(reps, /aria-label="Bench Press set 1 reps"/);
  const timed = await setLine({
    set: {
      ...model.newSet(),
      load: "bodyweight",
      measure: "seconds",
      reps: 30,
    },
  });
  assert.match(timed, /aria-label="Bench Press set 1 seconds"/);
  assert.match(timed, /placeholder="sec"/);
  const assisted = await setLine({
    set: { ...model.newSet(), load: "assisted", weight: 20, reps: 8 },
    marker: "minus",
  });
  assert.match(assisted, /aria-label="Bench Press set 1 assistance kilograms"/);
  const raw = await setLine({
    set: {
      ...model.newSet(),
      weight: null,
      reps: 8,
      inputText: { weight: "1e" },
    },
  });
  assert.match(raw, /value="1e"/);
  assert.match(raw, /aria-invalid="true"/);
});

test("completed rows still expose errors on invalid values", async () => {
  const html = await setLine({
    set: { ...model.newSet(), weight: 75, reps: -1, done: true },
  });
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /set-errors/);
  assert.match(html, /field-error">[^<]*reps/i);
  assert.doesNotMatch(html, /No previous log/);
});

test("BW controls render current profile kilograms without replacing a recorded snapshot", async () => {
  const set = { ...model.newSet(), load: "bodyweight", reps: 8 };
  const active = await setLine({ set, bodyWeightKg: 80 });
  assert.match(
    active,
    /class="sr-only">Bench Press set 1: Bodyweight 80 kilograms</,
  );
  assert.match(active, /aria-hidden="true">BW<small> 80 kg<\/small>/);
  assert.equal(tags(active, "input").length, 1, "plain BW has no load field");
  const recorded = await setLine({
    set: { ...set, done: true, bodyWeightKg: 78.5 },
    bodyWeightKg: 80,
  });
  assert.match(recorded, /: Bodyweight 78.5 kilograms</);
  assert.doesNotMatch(recorded, /Bodyweight 80 kilograms/);
  const legacy = await setLine({
    set: { ...set, done: true },
    bodyWeightKg: 80,
  });
  assert.match(legacy, /aria-hidden="true">BW<\/span>/);
  assert.match(legacy, /class="sr-only">Bench Press set 1: Bodyweight</);
  assert.doesNotMatch(legacy, /Bodyweight 80 kilograms/);
  const unknown = await setLine({ set, bodyWeightKg: null });
  assert.match(unknown, /class="sr-only">Bench Press set 1: Bodyweight</);
});

test("a BW exception marker shows the text BW instead of a field", async () => {
  const html = await setLine({
    set: { ...model.newSet(), load: "bodyweight", reps: 8 },
    marker: "bw",
  });
  assert.match(html, />BW</);
  assert.equal(tags(html, "input").length, 1);
});

test("exception markers render inside the field", async () => {
  const before = (html: string, marker: string) => {
    const at = html.indexOf(`>${marker}</span>`);
    return at !== -1 && at < html.indexOf("<input");
  };
  const plus = await setLine({
    set: {
      ...model.newSet(),
      load: "bodyweight",
      extraWeight: true,
      weight: 10,
      reps: 8,
    },
    marker: "plus",
  });
  assert.ok(before(plus, "+"), "+ comes before the input");
  assert.match(plus, /aria-hidden="true"[^>]*>\+<\/span>/);
  assert.match(plus, /aria-label="Bench Press set 1 added kilograms"/);

  const minus = await setLine({
    set: { ...model.newSet(), load: "assisted", weight: 25, reps: 8 },
    marker: "minus",
  });
  assert.ok(before(minus, "\u2212"), "\u2212 comes before the input");
  assert.match(minus, /aria-hidden="true"[^>]*>\u2212<\/span>/);
  assert.match(minus, /aria-label="Bench Press set 1 assistance kilograms"/);

  const kg = await setLine({
    set: { ...model.newSet(), weight: 40, reps: 8 },
    marker: "kg",
  });
  const suffix = kg.indexOf(">kg</span>");
  assert.ok(suffix > kg.indexOf("<input"), "kg comes after the input");
  assert.match(kg, /aria-hidden="true"[^>]*>kg<\/span>/);
  assert.match(kg, /aria-label="Bench Press set 1 kilograms"/);
  assert.doesNotMatch(kg, /added kilograms|assistance kilograms/);

  const none = await setLine({
    set: { ...model.newSet(), weight: 40, reps: 8 },
  });
  assert.doesNotMatch(none, /set-marker/);
});

test("a set that matches the exercise default still names its load", async () => {
  const html = await setLine({
    set: {
      ...model.newSet(),
      load: "bodyweight",
      extraWeight: true,
      weight: 10,
      reps: 8,
    },
    marker: "none",
  });
  assert.match(html, /added kilograms/);
  assert.doesNotMatch(html, /set-marker/);
});

test("drops and planned sets have no done button", async () => {
  const parent = { ...model.newSet(), weight: 80, reps: 5 };
  const drop = { ...model.newSet(), weight: 64, reps: 5, drop: true };
  const dropped = await setLine({
    set: drop,
    badge: setBadge([parent, drop], 1),
  });
  assert.doesNotMatch(dropped, /aria-pressed/);
  assert.match(dropped, /is-drop/);
  assert.match(dropped, /data-tone="drop"/);
  assert.match(dropped, />↓</);
  const planned = await setLine({
    set: { ...model.newSet(), weight: 80, reps: 5 },
    mode: "plan",
  });
  assert.doesNotMatch(planned, /aria-pressed/);
  assert.doesNotMatch(planned, /<button[^>]*aria-label="(Complete|Uncheck)/);
  // The empty cell keeps the grid: badge, previous, load, count and one more.
  assert.match(planned, /set-line-spacer/);
  const logged = await setLine({ set: { ...model.newSet(), reps: 5 } });
  assert.match(logged, /aria-pressed="false"/);
  assert.doesNotMatch(logged, /set-line-spacer/);
});

test("a set waiting on its drops explains the disabled check", async () => {
  const set = { ...model.newSet(), weight: 80, reps: 5 };
  const hint = "Fill in or delete its drops to check this set.";
  const waiting = await setLine({ set, canCheck: false, checkHint: hint });
  const [check] = tags(waiting, "button").filter((tag) =>
    tag.includes("aria-pressed"),
  );
  assert.match(check, /disabled=""/);
  const id = check.match(/aria-describedby="([^"]+)"/)?.[1];
  assert.ok(id, "the check points at its hint");
  const target = waiting.match(new RegExp(`<span[^>]*id="${id}"[^>]*>([^<]*)`));
  assert.equal(target?.[1], hint, "the described element holds the hint");
  assert.match(target![0], /class="sr-only"/);

  const ready = await setLine({ set, canCheck: true, checkHint: hint });
  assert.doesNotMatch(ready, /disabled=""/);
  assert.doesNotMatch(ready, /Fill in or delete/);

  // A checked set can always be unchecked, whatever canCheck says.
  const checked = await setLine({
    set: { ...set, done: true },
    canCheck: false,
    checkHint: hint,
  });
  assert.doesNotMatch(checked, /disabled=""/);
  assert.doesNotMatch(checked, /Fill in or delete/);

  // Without a hint a disabled check has nothing to point at.
  const bare = await setLine({ set, canCheck: false });
  assert.match(tags(bare, "button").join(""), /disabled=""/);
});

test("the edited set is marked", async () => {
  const set = { ...model.newSet(), weight: 80, reps: 5 };
  const editing = await setLine({ set, editing: true });
  assert.match(editing, /class="set-line[^"]*\bis-editing\b/);
  assert.match(editing, /class="set-badge[^"]*\bis-editing\b/);
  const idle = await setLine({ set });
  assert.doesNotMatch(idle, /is-editing/);
});

test("row state classes and the set id are on the line", async () => {
  const set = { ...model.newSet(), weight: 80, reps: 5, done: true };
  const html = await setLine({ set, next: true });
  const line = html.match(/^<div[^>]*>/)![0];
  assert.match(line, new RegExp(`data-set-id="${set.id}"`));
  assert.match(line, /class="set-line is-done is-next"/);
  assert.match(
    await setLine({ set: { ...set, done: false } }),
    /^<div[^>]*class="set-line"/,
  );
});

test("the badge is a labelled button carrying its tone", async () => {
  const sets = [
    { ...model.newSet(), section: "warmup" as const },
    { ...model.newSet(), section: "working" as const },
  ];
  const warm = await setLine({ set: sets[0], badge: setBadge(sets, 0) });
  assert.match(
    warm,
    /<button[^>]*aria-label="Warm-up set 1\. Change type, load or delete"[^>]*data-tone="warmup"|<button[^>]*data-tone="warmup"[^>]*aria-label="Warm-up set 1\. Change type, load or delete"/,
  );
  assert.match(warm, />W</);
  const working = await setLine({ set: sets[1], badge: setBadge(sets, 1) });
  assert.match(
    working,
    /aria-label="Set 1, working set\. Change type, load or delete"/,
  );
  assert.match(working, />1</);
  assert.match(warm, /aria-label="Complete Bench Press warm-up set 1"/);
});

test("the previous result sits in its own column, with a dash when there is none", async () => {
  const set = { ...model.newSet(), weight: 80, reps: 5 };
  const withPrevious = await setLine({ set, previous: "97.5 × 5" });
  assert.match(withPrevious, /<span class="set-previous">97\.5 × 5<\/span>/);
  const without = await setLine({ set });
  assert.match(without, /<span class="set-previous">–<\/span>/);
});

test("the next set is announced to screen readers", async () => {
  const set = { ...model.newSet(), weight: 80, reps: 5 };
  assert.match(
    await setLine({ set, next: true }),
    /<span class="sr-only">Next set<\/span>/,
  );
  assert.doesNotMatch(await setLine({ set }), /Next set/);
});

test("the workout stylesheet hides Previous on narrow phones, uses tokens only and respects reduced motion", () => {
  const sheet = css("src/styles/workout.css");
  assert.match(
    sheet,
    /@media \(max-width: 359px\)\s*\{[^@]*\.set-previous\s*\{[^}]*display:\s*none/,
  );
  assert.doesNotMatch(sheet, /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i);
  assert.doesNotMatch(sheet, /@import/);
  // The settle animation only runs when motion is allowed.
  assert.match(
    sheet,
    /@media \(prefers-reduced-motion: no-preference\)\s*\{[^@]*animation:/,
  );
  const line = readFileSync(
    new URL("../src/components/workout/SetLine.tsx", import.meta.url),
    "utf8",
  );
  assert.match(line, /import "@\/styles\/workout\.css";/);
});

test("rows of the same kind get different names", async () => {
  const sets: model.WorkoutSet[] = [
    { ...model.newSet(), section: "warmup", weight: 40, reps: 8 },
    { ...model.newSet(), section: "warmup", weight: 50, reps: 5 },
    { ...model.newSet(), weight: 80, reps: 5 },
    { ...model.newSet(), weight: 64, reps: 5, drop: true },
    { ...model.newSet(), weight: 52, reps: 5, drop: true },
  ];
  const html = await Promise.all(
    sets.map((set, i) =>
      setLine({
        set: { ...set, load: i === 1 ? "bodyweight" : set.load },
        badge: setBadge(sets, i),
      }),
    ),
  );
  const names = html.map(
    (row) => row.match(/aria-label="(Complete [^"]+)"/)?.[1],
  );
  // Drops have no check of their own: their input names tell them apart.
  assert.deepEqual(names.slice(0, 3), [
    "Complete Bench Press warm-up set 1",
    "Complete Bench Press warm-up set 2",
    "Complete Bench Press set 1",
  ]);
  assert.equal(names[3], undefined);
  const inputNames = html.flatMap((row) =>
    tags(row, "input").map((tag) => tag.match(/aria-label="([^"]+)"/)![1]),
  );
  assert.equal(
    new Set(inputNames).size,
    inputNames.length,
    "no two fields share a name",
  );
  assert.ok(inputNames.includes("Bench Press warm-up set 1 kilograms"));
  assert.ok(inputNames.includes("Bench Press warm-up set 2 reps"));
  assert.ok(inputNames.includes("Bench Press drop 1 after set 1 kilograms"));
  assert.ok(inputNames.includes("Bench Press drop 2 after set 1 reps"));
  // The badge buttons differ as well, so each opens a distinguishable sheet.
  const badgeLabels = html.map(
    (row) =>
      row.match(/<button[^>]*class="set-badge[^>]*aria-label="([^"]+)"/)![1],
  );
  assert.equal(new Set(badgeLabels).size, badgeLabels.length);
  assert.equal(badgeLabels[0], "Warm-up set 1. Change type, load or delete");
  assert.equal(badgeLabels[1], "Warm-up set 2. Change type, load or delete");
  assert.equal(badgeLabels[3], "Drop 1 after set 1. Change load or delete");
  assert.equal(badgeLabels[4], "Drop 2 after set 1. Change load or delete");
  // The bodyweight text of the second warm-up names its row too.
  assert.match(html[1], /Bench Press warm-up set 2: Bodyweight/);
});
