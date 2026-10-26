import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as model from "../src/data/model";
import * as editor from "../src/lib/workout-editor";
import * as editing from "../src/lib/set-editing";
import * as dates from "../src/lib/dates";
import * as loads from "../src/lib/set-load";
import * as input from "../src/lib/set-input";

// Render the actual component with React's server renderer. No browser or cloud
// is substituted: this checks the control/validation markup, not visual layout.
async function setRow(props: Record<string, unknown>) {
  const source = await readFile(
    new URL("../src/components/SetRow.tsx", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const require = createRequire(import.meta.url);
  const aliases: Record<string, unknown> = {
    "@/data/model": model,
    "@/lib/workout-editor": editor,
    "@/lib/set-editing": editing,
    "@/lib/dates": dates,
    "@/lib/set-load": loads,
    "@/lib/set-input": input,
  };
  const numericSource = await readFile(
    new URL("../src/components/SetNumberInput.tsx", import.meta.url),
    "utf8",
  );
  const numericExport = {};
  runInNewContext(
    ts.transpileModule(numericSource, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports: numericExport,
      require: (id: string) =>
        id === "../lib/set-input" ? input : require(id),
    },
  );
  aliases["@/components/SetNumberInput"] = numericExport;
  const exported: { default?: Parameters<typeof createElement>[0] } = {};
  runInNewContext(compiled.outputText, {
    exports: exported,
    require: (id: string) =>
      id.endsWith(".css") ? {} : (aliases[id] ?? require(id)),
  });
  return renderToStaticMarkup(
    createElement(exported.default!, {
      name: "Bench Press",
      index: 0,
      onChange: () => {},
      onRemove: () => {},
      ...props,
    }),
  );
}

test("compact editing keeps the unlock checkbox reachable without history clutter", async () => {
  const set = { ...model.newSet(), weight: 75, reps: 8, done: true };
  const html = await setRow({
    set,
    compact: true,
    previous: "70 kg × 8",
    previousDate: "2026-10-09",
    reorderHandle: createElement("button", { "aria-label": "Move set" }, "1"),
  });
  assert.match(html, /value="75"/);
  assert.match(html, /value="8"/);
  assert.match(html, /aria-label="Move set"/);
  assert.match(html, /Remove Bench Press set 1/);
  assert.doesNotMatch(html, /set-previous|No previous log|70 kg/);
  assert.match(html, /Uncheck Bench Press set 1/);
  assert.match(html, /readonly=""/);
  assert.ok(html.indexOf('value="warmup"') < html.indexOf('value="working"'));
  assert.ok(html.indexOf('value="working"') < html.indexOf('value="winddown"'));
});

test("empty sets omit instructional prompts while completed values remain read-only in historical editing", async () => {
  const empty = await setRow({ set: model.newSet() });
  assert.doesNotMatch(
    empty,
    /Enter reps to complete|Enter kg, or choose Bodyweight/,
  );
  const checked = await setRow({
    set: { ...model.newSet(), weight: 75, reps: 8, done: true },
    editing: true,
  });
  assert.equal((checked.match(/readonly=""/g) ?? []).length, 2);
  assert.match(checked, /Uncheck Bench Press set 1/);
});

test("extra BW uses the regular weight field with an added-weight label and profile context", async () => {
  const html = await setRow({
    set: {
      ...model.newSet(),
      load: "bodyweight",
      extraWeight: true,
      weight: 12.5,
      reps: 8,
    },
    bodyWeightKg: 80,
  });
  assert.match(html, /added weight kg/);
  assert.match(html, /value="12.5"/);
  assert.match(html, /BW \+/);
  assert.match(html, /80 kg BW/);
});

test("mixed exercise rows show their actual units and unfinished raw text remains visible", async () => {
  const reps = await setRow({
    set: { ...model.newSet(), weight: 75, reps: 8, done: true },
    showProfile: true,
  });
  assert.match(reps, /kg · Reps/);
  const timed = await setRow({
    set: {
      ...model.newSet(),
      load: "bodyweight",
      measure: "seconds",
      reps: 30,
    },
    showProfile: true,
  });
  assert.match(timed, /BW · Seconds/);
  const assisted = await setRow({
    set: { ...model.newSet(), load: "assisted", weight: 20, reps: 8 },
    showProfile: true,
  });
  assert.match(assisted, /Assist kg · Reps/);
  const raw = await setRow({
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

test("compact editing still exposes errors on invalid completed values", async () => {
  const html = await setRow({
    compact: true,
    set: { ...model.newSet(), weight: 75, reps: -1, done: true },
  });
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /set-errors/);
  assert.match(html, /field-error">[^<]*reps/i);
  assert.doesNotMatch(html, /No previous log/);
});

test("BW controls render current profile kilograms without replacing a recorded snapshot", async () => {
  const set = { ...model.newSet(), load: "bodyweight", reps: 8 };
  const active = await setRow({ set, bodyWeightKg: 80 });
  assert.match(active, /Bodyweight 80 kilograms/);
  assert.match(active, />80<small>kg BW/);
  const recorded = await setRow({
    set: { ...set, done: true, bodyWeightKg: 78.5 },
    bodyWeightKg: 80,
  });
  assert.match(recorded, /Bodyweight 78.5 kilograms/);
  assert.doesNotMatch(recorded, /Bodyweight 80 kilograms/);
  const legacy = await setRow({
    set: { ...set, done: true },
    bodyWeightKg: 80,
  });
  assert.match(legacy, /aria-label="Bodyweight">BW/);
  assert.doesNotMatch(legacy, /Bodyweight 80 kilograms/);
});
