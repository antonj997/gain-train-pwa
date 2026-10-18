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
  };
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

test("compact set editing keeps values and type but removes completion and history clutter", async () => {
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
  assert.doesNotMatch(
    html,
    /Complete Bench Press|Uncheck Bench Press|set-previous|No previous log|70 kg/,
  );
  assert.ok(html.indexOf('value="warmup"') < html.indexOf('value="working"'));
  assert.ok(html.indexOf('value="working"') < html.indexOf('value="winddown"'));
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
