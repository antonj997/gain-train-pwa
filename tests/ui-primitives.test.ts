import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createElement,
  createRef,
  forwardRef,
  type ElementType,
  type ReactNode,
  type Ref,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadComponent, loadModule } from "./helpers/render";

const count = (html: string, text: string) => html.split(text).length - 1;

// Radix renders dialog content through a portal that server rendering skips, so
// the dialog files are loaded against this stand-in. It renders every part as a
// plain element and records what Sheet and DialogContent hand to Radix.
const seen: {
  onOpenChange?: (open: boolean) => void;
  content?: Record<string, unknown>;
  contentRef?: Ref<HTMLElement>;
} = {};
const domProps = (props: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(props).filter(([, value]) => typeof value !== "function"),
  );
const part = (tag: string, name: string, record = false) =>
  Object.assign(
    forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
      if (record) {
        seen.content = props;
        seen.contentRef = ref;
      }
      return createElement(tag, {
        ...domProps(props),
        "data-part": name,
      });
    }),
    { displayName: name },
  );
const fakeRadix = {
  Root: (props: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: ReactNode;
  }) => {
    seen.onOpenChange = props.onOpenChange;
    return props.open ? props.children : null;
  },
  Portal: (props: { children?: ReactNode }) => props.children,
  Overlay: part("div", "overlay"),
  Content: part("div", "content", true),
  Title: part("h2", "title"),
  Description: part("p", "description"),
  Close: part("button", "close"),
};
const radix = { "@radix-ui/react-dialog": fakeRadix };

test("Segmented is a radiogroup with one checked option, a roving tab stop and disabled options", async () => {
  const Segmented = await loadComponent("../src/components/ui/Segmented.tsx");
  const options = [
    { value: "warmup", label: "Warm-up" },
    { value: "working", label: "Working" },
    { value: "winddown", label: "Cool-down", disabled: true },
  ];
  const html = renderToStaticMarkup(
    createElement(Segmented, {
      label: "Set type",
      value: "working",
      options,
      onChange() {},
    }),
  );
  assert.match(html, /role="radiogroup"/);
  assert.match(html, /aria-label="Set type"/);
  assert.equal(count(html, 'role="radio"'), 3);
  assert.equal(count(html, 'aria-checked="true"'), 1);
  assert.match(html, /aria-checked="true"[^>]*>Working</);
  assert.equal(count(html, 'disabled=""'), 1);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Cool-down</);
  // Only the checked option is in the tab order.
  assert.match(html, /tabindex="-1"[^>]*>Warm-up</);
  assert.match(html, /tabindex="0"[^>]*>Working</);
  assert.match(html, /tabindex="-1"[^>]*>Cool-down</);
});

test("Segmented keeps a tab stop when the checked option is disabled", async () => {
  const Segmented = await loadComponent("../src/components/ui/Segmented.tsx");
  const html = renderToStaticMarkup(
    createElement(Segmented, {
      label: "Load",
      value: "assist",
      options: [
        { value: "weight", label: "Weight" },
        { value: "assist", label: "Assist", disabled: true },
      ],
      onChange() {},
    }),
  );
  assert.equal(count(html, 'aria-checked="true"'), 1);
  assert.match(html, /tabindex="0"[^>]*>Weight</);
});

test("arrow keys move to the next enabled option, wrap, and skip disabled ones", async () => {
  const { nextOptionIndex } = await loadModule<{
    nextOptionIndex: (
      options: { disabled?: boolean }[],
      from: number,
      key: string,
    ) => number | null;
  }>("../src/lib/segmented-keys.ts");
  const options = [
    { disabled: false },
    { disabled: true },
    { disabled: false },
    { disabled: true },
  ];
  assert.equal(nextOptionIndex(options, 0, "ArrowRight"), 2);
  assert.equal(nextOptionIndex(options, 0, "ArrowDown"), 2);
  assert.equal(nextOptionIndex(options, 2, "ArrowRight"), 0);
  assert.equal(nextOptionIndex(options, 0, "ArrowLeft"), 2);
  assert.equal(nextOptionIndex(options, 2, "ArrowUp"), 0);
  assert.equal(nextOptionIndex([{}, {}, {}], 1, "Home"), 0);
  assert.equal(nextOptionIndex([{}, {}, {}], 1, "End"), 2);
  assert.equal(nextOptionIndex(options, 2, "End"), 2);
  assert.equal(nextOptionIndex(options, 2, "a"), null);
  assert.equal(nextOptionIndex([{ disabled: true }], 0, "ArrowRight"), null);
  assert.equal(nextOptionIndex([{}], 0, "ArrowRight"), 0);
});

test("Switch is a role=switch button that reports its state and name", async () => {
  const Switch = await loadComponent("../src/components/ui/Switch.tsx");
  const off = renderToStaticMarkup(
    createElement(Switch, {
      label: "Add extra weight",
      checked: false,
      onChange() {},
    }),
  );
  assert.match(off, /^<button[^>]*role="switch"/);
  assert.match(off, /aria-checked="false"/);
  assert.match(off, /type="button"/);
  assert.match(off, /Add extra weight/);
  assert.doesNotMatch(off, /disabled/);

  const on = renderToStaticMarkup(
    createElement(Switch, {
      label: "Add extra weight",
      checked: true,
      disabled: true,
      onChange() {},
    }),
  );
  assert.match(on, /aria-checked="true"/);
  assert.match(on, /disabled=""/);
});

test("DialogContent sets the backdrop on the overlay and offers a Close handle", async () => {
  const { Dialog, DialogContent } = await loadModule<
    Record<string, ElementType>
  >("../src/components/ui/dialog.tsx", radix);
  const render = (backdrop?: "dim" | "light") =>
    renderToStaticMarkup(
      createElement(
        Dialog,
        { open: true },
        createElement(DialogContent, { backdrop }, "Body"),
      ),
    );

  const overlay = (html: string) =>
    html.match(/<div[^>]*data-part="overlay"[^>]*>/)?.[0];
  const dim = render();
  assert.match(overlay(dim) ?? "", /data-backdrop="dim"/);
  assert.match(overlay(render("light")) ?? "", /data-backdrop="light"/);
  assert.match(dim, /<button[^>]*aria-label="Close"/);
  assert.match(dim, /Body/);
  // The backdrop prop is not forwarded to the content element.
  assert.equal("backdrop" in (seen.content ?? {}), false);
});

test("Sheet shows its title and content only while open", async () => {
  const Sheet = await loadComponent("../src/components/ui/Sheet.tsx", radix);
  const props = { title: "Set 2", onClose() {} };
  assert.equal(
    renderToStaticMarkup(
      createElement(Sheet, { ...props, open: false }, "Inside"),
    ),
    "",
  );
  const html = renderToStaticMarkup(
    createElement(Sheet, { ...props, open: true }, "Inside"),
  );
  assert.match(html, /<h2[^>]*>Set 2<\/h2>/);
  assert.match(html, /Inside/);
  assert.match(html, /data-backdrop="dim"/);

  // The real Radix dialog renders its content through a portal, which server
  // rendering skips: it must load and render empty rather than throw.
  const Real = await loadComponent("../src/components/ui/Sheet.tsx");
  assert.equal(
    renderToStaticMarkup(
      createElement(Real, { ...props, open: true }, "Inside"),
    ),
    "",
  );
});

test("Sheet passes backdrop, class, ref and Escape handler to the dialog and closes on dismissal", async () => {
  const Sheet = await loadComponent("../src/components/ui/Sheet.tsx", radix);
  const contentRef = createRef<HTMLDivElement>();
  const onEscapeKeyDown = () => {};
  let closed = 0;
  const html = renderToStaticMarkup(
    createElement(
      Sheet,
      {
        open: true,
        title: "Set 2",
        backdrop: "light",
        className: "set-sheet",
        contentRef,
        onEscapeKeyDown,
        onClose: () => closed++,
      },
      "Inside",
    ),
  );
  assert.match(html, /data-backdrop="light"/);
  assert.match(html, /class="[^"]*\bset-sheet\b/);
  // The dialog merges the caller's ref with its own (for dragging), so check
  // that the caller's ref is filled rather than passed through as-is.
  const node = {} as HTMLDivElement;
  (seen.contentRef as (node: HTMLDivElement | null) => void)(node);
  assert.equal(contentRef.current, node);
  assert.equal(seen.content?.onEscapeKeyDown, onEscapeKeyDown);

  // Radix reports a tap outside, Escape or the handle as onOpenChange(false).
  seen.onOpenChange?.(true);
  assert.equal(closed, 0);
  seen.onOpenChange?.(false);
  assert.equal(closed, 1);
});

test("Sheet leaves the dialog undescribed unless it is given a description", async () => {
  const Sheet = await loadComponent("../src/components/ui/Sheet.tsx", radix);
  const render = (description?: string) => {
    renderToStaticMarkup(
      createElement(
        Sheet,
        { open: true, title: "Set 2", description, onClose() {} },
        "Inside",
      ),
    );
    return seen.content!;
  };
  // An explicit undefined stops Radix warning about a missing description.
  const bare = render();
  assert.equal("aria-describedby" in bare, true);
  assert.equal(bare["aria-describedby"], undefined);
  assert.equal("aria-describedby" in render("Details"), false);
});

test("ConfirmDialog renders through Sheet with its title, description and ordered buttons", async () => {
  const ConfirmDialog = await loadComponent(
    "../src/components/ConfirmDialog.tsx",
    radix,
  );
  const props = {
    open: true,
    title: "Delete workout?",
    description: "This cannot be undone.",
    cancelLabel: "Keep",
    confirmLabel: "Delete",
    onCancel() {},
    onConfirm() {},
  };
  const danger = renderToStaticMarkup(createElement(ConfirmDialog, props));
  assert.match(danger, /<h2[^>]*>Delete workout\?<\/h2>/);
  assert.match(danger, /<p[^>]*>This cannot be undone\.<\/p>/);
  assert.match(danger, /data-backdrop="dim"/);
  // Removals put the safe choice first.
  assert.ok(danger.indexOf(">Keep<") < danger.indexOf(">Delete<"));
  assert.match(danger, /class="secondary danger"[^>]*>Delete</);

  const primary = renderToStaticMarkup(
    createElement(ConfirmDialog, { ...props, tone: "primary" }),
  );
  assert.ok(primary.indexOf(">Delete<") < primary.indexOf(">Keep<"));
  assert.match(primary, /class="primary"[^>]*>Delete</);

  const busy = renderToStaticMarkup(
    createElement(ConfirmDialog, { ...props, busy: true }),
  );
  assert.equal(count(busy, 'disabled=""'), 2);
  assert.equal(
    renderToStaticMarkup(
      createElement(ConfirmDialog, { ...props, open: false }),
    ),
    "",
  );
});

test("ConfirmDialog cancels when dismissed, except while busy", async () => {
  const ConfirmDialog = await loadComponent(
    "../src/components/ConfirmDialog.tsx",
    radix,
  );
  let cancelled = 0;
  const render = (busy: boolean) =>
    renderToStaticMarkup(
      createElement(ConfirmDialog, {
        open: true,
        title: "Delete?",
        description: "Sure?",
        cancelLabel: "No",
        confirmLabel: "Yes",
        busy,
        onCancel: () => cancelled++,
        onConfirm() {},
      }),
    );
  render(false);
  seen.onOpenChange?.(false);
  assert.equal(cancelled, 1);
  render(true);
  seen.onOpenChange?.(false);
  assert.equal(cancelled, 1);
});

test("loadModule shares one copy of an import, compiles JSX, stubs css and lets aliases win", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "render-helper-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "shared.tsx"), "export const shared = {};");
  writeFileSync(
    join(dir, "a.tsx"),
    "import { shared } from './shared';\nimport './missing.css';\nexport const a = shared;",
  );
  writeFileSync(
    join(dir, "b.tsx"),
    [
      "import { shared } from './shared';",
      "import { a } from './a';",
      "export default function B() { return <p>{String(a === shared)}</p>; }",
    ].join("\n"),
  );

  const B = await loadComponent(join(dir, "b.tsx"));
  assert.equal(renderToStaticMarkup(createElement(B)), "<p>true</p>");
  const { a } = await loadModule<{ a: unknown }>(join(dir, "a.tsx"), {
    "./shared": { shared: 42 },
  });
  assert.equal(a, 42);
  await assert.rejects(loadModule(join(dir, "none.tsx")), /no file at/);
});

test("segmented options and the icon button keep a 44px target", () => {
  const css = readFileSync(
    new URL("../src/styles/components.css", import.meta.url),
    "utf8",
  );
  const height = (selector: string) =>
    css.match(
      new RegExp(`${selector}\\s*\\{[^}]*?(?:min-)?height:\\s*(\\d+)px`),
    )?.[1];
  assert.equal(height("\\.segmented button"), "44");
  assert.equal(height("\\.icon-btn"), "44");
});
