import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as editing from "../src/lib/set-editing";
import { newSet, type WorkoutSet } from "../src/data/model";

type KeyEvent = {
  key: string;
  preventDefault: () => void;
  stopPropagation: () => void;
};
type PointerEvent = {
  isPrimary: boolean;
  button: number;
  pointerId: number;
  pointerType: string;
  clientY: number;
  currentTarget: { focus: () => void };
  preventDefault: () => void;
  stopPropagation: () => void;
};
type HandleProps = { onPointerDown: (event: PointerEvent) => void };
type SetElement = {
  props: { "data-sortable-set-id": string; children: { props: HandleProps } };
};
type Tree = {
  ref: { current: unknown };
  props: {
    children: unknown[];
    onPointerMove: (event: PointerEvent) => void;
    onPointerUp: (event: PointerEvent) => void;
    onLostPointerCapture: (event: PointerEvent) => void;
  };
};
type Props = {
  sets: WorkoutSet[];
  name: string;
  onReorder: (sets: WorkoutSet[]) => void;
  children: (set: WorkoutSet, index: number, handle: unknown) => unknown;
};
type ScrollBox = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  ownerDocument?: object;
};
type Row = {
  node: SetElement;
  dataset: { sortableSetId: string };
  getBoundingClientRect: () => { top: number; height: number };
};
type Effect = {
  deps: unknown[];
  callback: () => void | (() => void);
  cleanup?: () => void;
  pending: boolean;
};

function isSetElement(value: unknown): value is SetElement {
  if (!value || typeof value !== "object" || !("props" in value)) return false;
  const props = value.props;
  return (
    !!props && typeof props === "object" && "data-sortable-set-id" in props
  );
}

// Exercise the real component's event wiring with a minimal hook/geometry host.
// This is not a browser/device test; native selection and rendering need one.
async function component() {
  const values: unknown[] = [],
    refs: { current: unknown }[] = [],
    effects: Effect[] = [],
    callbacks: { deps: unknown[]; callback: unknown }[] = [];
  let stateIndex = 0,
    refIndex = 0,
    effectIndex = 0,
    callbackIndex = 0,
    frameId = 0;
  const frames = new Map<number, (time: number) => void>();
  const listeners = new Map<
    string,
    { callback: (event: KeyEvent) => void; capture: boolean }
  >();
  const hooks = {
    useState: (initial: unknown) => {
      const index = stateIndex++;
      if (!(index in values)) values[index] = initial;
      return [
        values[index],
        (next: unknown) => {
          values[index] =
            typeof next === "function" ? next(values[index]) : next;
        },
      ];
    },
    useRef: (initial: unknown) =>
      refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial }),
    useId: () => "instructions",
    useCallback: (callback: unknown, deps: unknown[]) => {
      const index = callbackIndex++,
        previous = callbacks[index];
      if (!previous || deps.some((value, i) => value !== previous.deps[i]))
        callbacks[index] = { deps, callback };
      return callbacks[index].callback;
    },
    useEffect: effect,
    useLayoutEffect: effect,
  };
  function effect(callback: () => void | (() => void), deps: unknown[] = []) {
    const index = effectIndex++,
      previous = effects[index];
    if (!previous || deps.some((value, i) => value !== previous.deps[i]))
      effects[index] = {
        deps,
        callback,
        cleanup: previous?.cleanup,
        pending: true,
      };
  }
  const window = {
    innerHeight: 300,
    requestAnimationFrame: (callback: (time: number) => void) => {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    addEventListener: (
      name: string,
      callback: (event: KeyEvent) => void,
      capture: boolean,
    ) => listeners.set(name, { callback, capture }),
    removeEventListener: (name: string) => listeners.delete(name),
  };
  const body = {};
  const documentScroll: ScrollBox = {
    scrollTop: 0,
    scrollHeight: 900,
    clientHeight: 300,
  };
  const ownerDocument = {
    body,
    scrollingElement: documentScroll,
    documentElement: documentScroll,
    defaultView: { getComputedStyle: () => ({ overflowY: "auto" }) },
  };
  const modal = {
    ownerDocument,
    parentElement: body,
    scrollTop: 0,
    scrollHeight: 600,
    clientHeight: 150,
    getBoundingClientRect: () => ({ top: 0, bottom: 150 }),
  };
  documentScroll.ownerDocument = ownerDocument;
  const captured = new Set<number>();
  let rows: Row[] = [];
  const list = {
    ownerDocument,
    parentElement: modal,
    querySelectorAll: () => rows,
    setPointerCapture: (id: number) => captured.add(id),
    hasPointerCapture: (id: number) => captured.has(id),
    releasePointerCapture: (id: number) => captured.delete(id),
  };
  const source = await readFile(
    new URL("../src/components/SortableSetList.tsx", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const require = createRequire(import.meta.url),
    exported: { default?: (props: Props) => Tree } = {};
  runInNewContext(compiled.outputText, {
    exports: exported,
    window,
    require: (id: string) =>
      id === "react"
        ? hooks
        : id === "@/lib/set-editing"
          ? editing
          : id.endsWith(".css")
            ? {}
            : require(id),
  });
  const sets = [30, 40, 50].map((weight) => ({ ...newSet(), weight, reps: 8 }));
  const commits: WorkoutSet[][] = [];
  let tree: Tree;
  function render() {
    stateIndex = refIndex = effectIndex = callbackIndex = 0;
    tree = exported.default!({
      sets,
      name: "Bench Press",
      onReorder: (next: WorkoutSet[]) => commits.push(next),
      children: (_set: WorkoutSet, _index: number, handle: unknown) => handle,
    });
    tree.ref.current = list;
    rows = tree.props.children
      .flat(Infinity)
      .filter(isSetElement)
      .map((child, i) => ({
        node: child,
        dataset: { sortableSetId: child.props["data-sortable-set-id"] },
        getBoundingClientRect: () => ({
          top: 30 + i * 50 - modal.scrollTop,
          height: 40,
        }),
      }));
    for (const item of effects)
      if (item.pending) {
        item.cleanup?.();
        const cleanup = item.callback();
        item.cleanup = typeof cleanup === "function" ? cleanup : undefined;
        item.pending = false;
      }
    return tree;
  }
  render();
  const handleElement = { focus: () => {} };
  const event = (extra: Partial<PointerEvent> = {}): PointerEvent => ({
    isPrimary: true,
    button: 0,
    pointerId: 7,
    pointerType: "touch",
    clientY: 50,
    currentTarget: handleElement,
    preventDefault: () => {},
    stopPropagation: () => {},
    ...extra,
  });
  return {
    sets,
    commits,
    modal,
    documentScroll,
    frames,
    captured,
    listeners,
    render,
    event,
    handle: () => rows[0].node.props.children.props,
    root: () => tree.props,
    order: () => rows.map((row) => row.dataset.sortableSetId),
    tick: (time: number) => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(time));
    },
    unmount: () => {
      for (const item of effects) item.cleanup?.();
    },
  };
}

test("real set list captures touch on stable list, previews locally and scrolls a routine dialog before one drop commit", async () => {
  const host = await component();
  host.handle().onPointerDown(host.event());
  host.render();
  assert.equal(host.captured.has(7), true);
  host.root().onPointerMove(host.event({ clientY: 145 }));
  host.render();
  assert.equal(host.commits.length, 0);
  host.tick(16);
  host.tick(32);
  host.render();
  assert.ok(host.modal.scrollTop > 0, "stationary edge scrolls the dialog");
  assert.equal(host.documentScroll.scrollTop, 0, "body stays put");
  assert.equal(host.order().at(-1), host.sets[0].id);
  host.root().onPointerUp(host.event());
  host.render();
  assert.equal(host.commits.length, 1);
  assert.deepEqual(
    host.commits[0].map((set) => set.weight),
    [40, 50, 30],
  );
  assert.equal(host.commits[0][2], host.sets[0]);
  assert.equal(host.frames.size, 0);
  assert.equal(host.captured.size, 0);
  host.root().onLostPointerCapture(host.event());
  assert.equal(host.commits.length, 1);
  host.unmount();
});

test("real set list cancels before the routine dialog Escape listener and releases pointer/RAF state", async () => {
  const host = await component();
  host.handle().onPointerDown(host.event());
  host.render();
  host.root().onPointerMove(host.event({ clientY: 145 }));
  host.render();
  const escape = host.listeners.get("keydown");
  assert.equal(escape?.capture, true);
  let stopped = false,
    prevented = false;
  escape?.callback({
    key: "Escape",
    preventDefault: () => {
      prevented = true;
    },
    stopPropagation: () => {
      stopped = true;
    },
  });
  host.render();
  assert.equal(stopped && prevented, true);
  assert.equal(host.commits.length, 0);
  assert.deepEqual(
    Array.from(host.order()),
    host.sets.map((set) => set.id),
  );
  assert.equal(host.frames.size, 0);
  assert.equal(host.captured.size, 0);
  host.handle().onPointerDown(host.event());
  host.unmount();
  assert.equal(host.frames.size, 0);
  assert.equal(host.captured.size, 0);
});
