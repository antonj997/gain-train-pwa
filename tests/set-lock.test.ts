import test from "node:test";
import assert from "node:assert/strict";
import * as model from "../src/data/model";
import * as editing from "../src/lib/set-editing";
import { setBadge } from "../src/data/drops";
import { loadComponent } from "./helpers/render";

type Node = { type: unknown; props: Record<string, unknown> };
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}

// The real SetLine's state and callbacks, with a small hook/element host.
// Native input behavior and visual rendering are verified separately.
async function host(
  initial: model.WorkoutSet,
  props: Record<string, unknown> = {},
) {
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
  const SetLine = (await loadComponent(
    "../src/components/workout/SetLine.tsx",
    {
      react: hooks,
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "@/components/SetNumberInput": { default: "number-field" },
    },
  )) as (props: Record<string, unknown>) => Node;
  const state = {
    set: initial,
    changes: [] as model.WorkoutSet[],
    toggles: 0,
    sheets: 0,
  };
  const render = () => {
    index = 0;
    return nodes(
      SetLine({
        set: state.set,
        mode: "log",
        name: "Bench",
        badge: setBadge([state.set], 0),
        marker: "none",
        canCheck: true,
        onOpenSheet: () => {
          state.sheets++;
        },
        onChange: (next: model.WorkoutSet) => {
          state.changes.push(next);
          state.set = next;
        },
        // What a card does: toggle the row and re-render with the result.
        onToggleDone: () => {
          state.toggles++;
          state.set = editing.toggleSetCompletion(state.set, null);
        },
        ...props,
      }),
    );
  };
  return { state, render };
}

const fields = (tree: Node[]) =>
  tree.filter((node) => node.type === "number-field");
const message = (tree: Node[]) =>
  tree.find(
    (node) =>
      node.type === "p" &&
      node.props.children === "Uncheck this set to edit its values.",
  );

test("completed logging rows reject edits, warn, and require explicit unchecking", async () => {
  const { state, render } = await host({
    ...model.newSet(),
    weight: 75,
    reps: 8,
    done: true,
  });
  let tree = render();
  const [field] = fields(tree);
  assert.equal(field.props.readOnly, true);
  (field.props.onValueChange as (value: number) => void)(90);
  assert.equal(state.changes.length, 0);
  tree = render();
  assert.ok(message(tree));
  const unlock = tree.find(
    (node) => node.props["aria-label"] === "Uncheck Bench set 1",
  )!;
  assert.match(String(unlock.props.className), /unlock-highlight/);
  assert.equal(
    unlock.props["aria-describedby"],
    `set-locked-${state.set.id}`,
    "the check explains the lock",
  );
  (unlock.props.onClick as () => void)();
  assert.equal(state.toggles, 1);
  assert.equal(state.set.done, false);
  assert.equal(state.set.weight, 75);
  tree = render();
  assert.equal(message(tree), undefined, "unchecking clears the warning");
  const [editable] = fields(tree);
  assert.equal(editable.props.readOnly, false);
  (editable.props.onValueChange as (value: number) => void)(90);
  assert.equal(state.set.weight, 90);
  assert.equal(state.set.done, false);
});

test("focusing or typing into a locked count field shows the same warning", async () => {
  const { state, render } = await host({
    ...model.newSet(),
    weight: 75,
    reps: 8,
    done: true,
  });
  const [, count] = fields(render());
  assert.equal(count.props.readOnly, true);
  (count.props.onLockedAttempt as () => void)();
  const tree = render();
  assert.ok(message(tree));
  assert.equal(state.changes.length, 0);
  const [load, again] = fields(tree);
  for (const field of [load, again])
    assert.match(String(field.props["aria-describedby"]), /set-locked-/);
});

test("an unchecked row passes edits, unfinished text and the checkmark to its owner", async () => {
  const { state, render } = await host({ ...model.newSet(), reps: 8 });
  let tree = render();
  const [load, count] = fields(tree);
  (load.props.onValueChange as (v: number | null, t?: string) => void)(
    null,
    "1e",
  );
  assert.equal(state.set.inputText?.weight, "1e");
  (count.props.onValueChange as (v: number) => void)(10);
  assert.equal(state.set.reps, 10);
  assert.equal(message(render()), undefined);
  tree = render();
  const done = tree.find((node) => node.props["aria-pressed"] !== undefined)!;
  assert.equal(done.props["aria-label"], "Complete Bench set 1");
  assert.equal(state.toggles, 0, "editing does not toggle");
});

test("the badge opens the sheet and focus reaches the owner", async () => {
  let focused = 0;
  const { state, render } = await host(
    { ...model.newSet(), weight: 75, reps: 8 },
    { onFocus: () => focused++ },
  );
  const tree = render();
  const badge = tree.find(
    (node) => (node.props.badge as { tone?: string })?.tone === "working",
  )!;
  (badge.props.onClick as () => void)();
  assert.equal(state.sheets, 1);
  const line = tree.find((node) => node.props["data-set-id"] !== undefined)!;
  assert.equal(line.props["data-set-id"], state.set.id);
  (line.props.onFocusCapture as () => void)();
  assert.equal(focused, 1);
});

test("a completed drop is locked too, and its check belongs to the set above", async () => {
  const drop = {
    ...model.newSet(),
    weight: 64,
    reps: 5,
    drop: true,
    done: true,
  };
  const { state, render } = await host(drop, {
    badge: setBadge([{ ...model.newSet(), done: true }, drop], 1),
  });
  let tree = render();
  const [field] = fields(tree);
  assert.equal(field.props.readOnly, true);
  (field.props.onValueChange as (value: number) => void)(60);
  assert.equal(state.changes.length, 0);
  tree = render();
  assert.ok(message(tree), "the drop explains why it cannot change");
  assert.equal(
    tree.some((node) => node.props["aria-pressed"] !== undefined),
    false,
    "a drop has no check of its own",
  );
});

test("a drop forgets its locked-edit notice once the set above is unchecked", async () => {
  const drop = {
    ...model.newSet(),
    weight: 64,
    reps: 5,
    drop: true,
    done: true,
  };
  const { state, render } = await host(drop);
  const [field] = fields(render());
  (field.props.onLockedAttempt as () => void)();
  assert.ok(message(render()));
  // The set above is unchecked, which unchecks the drop.
  state.set = { ...drop, done: false };
  assert.equal(message(render()), undefined);
  // Checked again, the old notice does not come back by itself.
  state.set = { ...drop, done: true };
  assert.equal(message(render()), undefined);
});
