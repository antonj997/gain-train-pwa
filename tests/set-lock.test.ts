import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as model from "../src/data/model";
import * as editor from "../src/lib/workout-editor";
import * as editing from "../src/lib/set-editing";
import * as dates from "../src/lib/dates";
import * as loads from "../src/lib/set-load";
import * as input from "../src/lib/set-input";

type Node = { type: unknown; props: Record<string, unknown> };
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}

// The real SetRow's state and callbacks, with a small hook/element host.
// Native input behavior and visual rendering are verified separately.
for (const compact of [false, true]) {
  test(`completed ${compact ? "compact" : "logging"} rows reject edits, warn, and require explicit unchecking`, async () => {
    let index = 0;
    const states: unknown[] = [];
    const hooks = {
      useState(initial: unknown) {
        const current = index++;
        if (!(current in states)) states[current] = initial;
        return [
          states[current],
          (next: unknown) => {
            states[current] = next;
          },
        ];
      },
      useRef: (current: unknown) => ({ current }),
      useEffect() {},
    };
    const jsx = (type: unknown, props: Record<string, unknown>) => ({
      type,
      props,
    });
    const require = createRequire(import.meta.url);
    const aliases: Record<string, unknown> = {
      react: hooks,
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "@/data/model": model,
      "@/lib/workout-editor": editor,
      "@/lib/set-editing": editing,
      "@/lib/dates": dates,
      "@/lib/set-load": loads,
      "@/lib/set-input": input,
      "@/components/SetNumberInput": { default: "number-field" },
    };
    const source = await readFile(
      new URL("../src/components/SetRow.tsx", import.meta.url),
      "utf8",
    );
    const exported: { default?: (props: Record<string, unknown>) => Node } = {};
    runInNewContext(
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      {
        exports: exported,
        require: (id: string) =>
          id.endsWith(".css") ? {} : (aliases[id] ?? require(id)),
      },
    );
    let set = { ...model.newSet(), weight: 75, reps: 8, done: true };
    const changes: model.WorkoutSet[] = [];
    const render = () => {
      index = 0;
      return nodes(
        exported.default!({
          set,
          compact,
          name: "Bench",
          index: 0,
          onChange: (next: model.WorkoutSet) => {
            changes.push(next);
            set = next;
          },
          onRemove() {},
        }),
      );
    };
    let tree = render();
    const field = tree.find((node) => node.type === "number-field")!;
    assert.equal(field.props.readOnly, true);
    (field.props.onValueChange as (value: number) => void)(90);
    assert.equal(changes.length, 0);
    tree = render();
    assert.ok(
      tree.some(
        (node) =>
          node.type === "p" &&
          node.props.children === "Uncheck this set to edit its values.",
      ),
    );
    const unlock = tree.find(
      (node) => node.props["aria-label"] === "Uncheck Bench set 1",
    )!;
    assert.match(String(unlock.props.className), /unlock-highlight/);
    (unlock.props.onClick as () => void)();
    assert.equal(changes.length, 1);
    assert.equal(set.done, false);
    assert.equal(set.weight, 75);
    tree = render();
    const editable = tree.find((node) => node.type === "number-field")!;
    assert.equal(editable.props.readOnly, false);
    (editable.props.onValueChange as (value: number) => void)(90);
    assert.equal(set.weight, 90);
    assert.equal(set.done, false);
  });
}
