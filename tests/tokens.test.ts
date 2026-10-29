import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/** Top-level rules of a stylesheet, as selector and body (nested rules stay in the body). */
function topLevelRules(source: string) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: { selector: string; body: string }[] = [];
  let depth = 0;
  let selectorStart = 0;
  let bodyStart = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "{") {
      if (depth === 0) bodyStart = i + 1;
      depth++;
    } else if (css[i] === "}") {
      depth--;
      if (depth === 0) {
        rules.push({
          // Skip any @import statements that precede the rule.
          selector: css
            .slice(selectorStart, bodyStart - 1)
            .split(";")
            .pop()!
            .trim(),
          body: css.slice(bodyStart, i),
        });
        selectorStart = i + 1;
      }
    }
  }
  return rules;
}

const declarations = (body: string) => {
  const found = new Map<string, string>();
  for (const [, name, value] of body.matchAll(
    /(--gt-[a-z0-9-]+)\s*:\s*([^;]+);/g,
  ))
    found.set(name, value.trim().replace(/\s+/g, " "));
  return found;
};

const tokensCss = read("src/styles/tokens.css");
const rules = topLevelRules(tokensCss);
const block = (selector: string) => {
  const rule = rules.find((r) => r.selector === selector);
  assert.ok(rule, `tokens.css has a top-level ${selector} block`);
  return declarations(rule.body);
};
const light = block(":root");
const dark = block(".dark");

const colourTokens = [
  "ground",
  "surface",
  "surface-2",
  "line",
  "line-strong",
  "ink",
  "ink-2",
  "ink-3",
  "accent",
  "on-accent",
  "accent-soft",
  "done",
  "done-soft",
  "warm-fg",
  "warm-bg",
  "cool-fg",
  "cool-bg",
  "danger-fg",
  "danger-bg",
];

// Spec section 3, verbatim.
const spec: Record<string, [string, string]> = {
  ground: ["#F4F5F7", "#0F1115"],
  surface: ["#FFFFFF", "#181B21"],
  "surface-2": ["#F0F2F5", "#22262E"],
  line: ["#E6E8EC", "#2A2F38"],
  "line-strong": ["#DDE1E7", "#343A45"],
  ink: ["#14161A", "#F2F4F7"],
  "ink-2": ["#5B6270", "#A3ACBA"],
  "ink-3": ["#8A93A3", "#7D8696"],
  accent: ["#2F5BEA", "#7C9BFF"],
  "on-accent": ["#FFFFFF", "#0F1115"],
  "accent-soft": ["#EEF3FF", "#1C2540"],
  done: ["#1E7A4C", "#3CC985"],
  "done-soft": ["#EEF7F2", "#13261D"],
  "warm-fg": ["#8A5300", "#FFC266"],
  "warm-bg": ["#FFF1DB", "#3A2A12"],
  "cool-fg": ["#1F4F9E", "#8CB8FF"],
  "cool-bg": ["#E4EEFF", "#142640"],
  "danger-fg": ["#B42318", "#FF8A80"],
  "danger-bg": ["#FDECEC", "#3A1715"],
};

const hex = /^#[0-9a-f]{6}$/i;

function luminance(colour: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(colour.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const themes = [
  ["light", light],
  ["dark", dark],
] as const;

test("every colour token exists in both themes with the spec value", () => {
  for (const [name, tokens] of themes) {
    for (const token of colourTokens) {
      const value = tokens.get(`--gt-${token}`);
      assert.ok(value, `--gt-${token} is defined in ${name}`);
      assert.match(value, hex, `--gt-${token} is a hex colour in ${name}`);
      const expected = spec[token][name === "light" ? 0 : 1];
      assert.equal(
        value.toUpperCase(),
        expected,
        `--gt-${token} in ${name} matches the spec`,
      );
    }
  }
});

const textPairs = [
  ["ink", "ground"],
  ["ink", "surface"],
  ["ink-2", "surface"],
  ["ink-2", "surface-2"],
  ["ink-2", "ground"],
  ["accent", "surface"],
  ["accent", "accent-soft"],
  ["on-accent", "accent"],
  ["done", "done-soft"],
  ["warm-fg", "warm-bg"],
  ["cool-fg", "cool-bg"],
  ["danger-fg", "danger-bg"],
] as const;

test("text pairs reach WCAG AA (4.5:1) in both themes", () => {
  for (const [name, tokens] of themes) {
    for (const [fg, bg] of textPairs) {
      const ratio = contrast(
        tokens.get(`--gt-${fg}`)!,
        tokens.get(`--gt-${bg}`)!,
      );
      assert.ok(
        ratio >= 4.5,
        `${fg} on ${bg} in ${name} is ${ratio.toFixed(2)}:1, needs 4.5:1`,
      );
    }
  }
});

test("ink-3 is only for disabled controls and icons, so 3:1 on surface is enough", () => {
  for (const [name, tokens] of themes) {
    const ratio = contrast(
      tokens.get("--gt-ink-3")!,
      tokens.get("--gt-surface")!,
    );
    assert.ok(
      ratio >= 3,
      `ink-3 on surface in ${name} is ${ratio.toFixed(2)}:1, needs 3:1`,
    );
  }
});

test("type, spacing, radius and motion tokens are defined once on :root", () => {
  const expected: Record<string, string> = {
    "--gt-font":
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    "--gt-fs-1": "12px",
    "--gt-fs-2": "13px",
    "--gt-fs-3": "15px",
    "--gt-fs-4": "17px",
    "--gt-fs-5": "20px",
    "--gt-fs-6": "28px",
    "--gt-space-1": "4px",
    "--gt-space-2": "8px",
    "--gt-space-3": "12px",
    "--gt-space-4": "16px",
    "--gt-space-5": "24px",
    "--gt-space-6": "32px",
    "--gt-radius-sm": "10px",
    "--gt-radius-md": "12px",
    "--gt-radius-lg": "18px",
    "--gt-radius-xl": "22px",
    "--gt-motion": "180ms ease-out",
  };
  for (const [name, value] of Object.entries(expected)) {
    assert.equal(light.get(name), value, `${name} on :root`);
    assert.equal(dark.has(name), false, `${name} is not repeated in .dark`);
  }
});

test("motion is switched off under prefers-reduced-motion", () => {
  const media = rules.find(
    (r) => r.selector === "@media (prefers-reduced-motion: reduce)",
  );
  assert.ok(media, "tokens.css has a reduced-motion block");
  const inner = topLevelRules(media.body).find((r) => r.selector === ":root");
  assert.ok(inner, "the reduced-motion block targets :root");
  assert.equal(declarations(inner.body).get("--gt-motion"), "0ms");
});

test("the .dark block comes after :root so it wins at equal specificity", () => {
  const selectors = rules.map((r) => r.selector);
  assert.ok(selectors.indexOf(".dark") > selectors.indexOf(":root"));
});

test("index.css imports the tokens first and uses the system font", () => {
  const css = read("src/index.css");
  assert.match(css, /^@import "\.\/styles\/tokens\.css";/);
  const body = topLevelRules(css).find((r) => r.selector === "body");
  assert.ok(body);
  assert.match(body.body, /font-family:\s*var\(--gt-font\)/);
  assert.doesNotMatch(css, /\bInter\b/);
});

test("the existing colour variables are defined from the tokens", () => {
  const css = read("src/index.css");
  const root = topLevelRules(css).find((r) => r.selector === ":root");
  assert.ok(root);
  const map: Record<string, string> = {
    "--blue": "--gt-accent",
    "--ink": "--gt-ink",
    "--soft": "--gt-ink-2",
    "--line": "--gt-line",
    "--surface": "--gt-surface",
    "--background": "--gt-ground",
    "--border": "--gt-line",
  };
  for (const [name, token] of Object.entries(map)) {
    assert.match(
      root.body,
      new RegExp(`${name}:\\s*var\\(${token}\\);`),
      `${name} is defined as var(${token})`,
    );
  }
  // Nothing may re-declare a colour variable in the dark block: the tokens flip.
  const darkBlock = topLevelRules(css).find((r) => r.selector === ".dark");
  assert.ok(darkBlock);
  assert.doesNotMatch(
    darkBlock.body,
    /--(blue|ink|soft|line|surface|background|card|border|muted-foreground|completed)\s*:/,
  );
});

test("no stylesheet wraps a colour variable in hsl()", () => {
  // The variables hold full colours now, so hsl(var(--x)) would be invalid.
  for (const file of readdirSync(new URL("../src/styles/", import.meta.url))) {
    if (file.endsWith(".css") && file !== "reset.css")
      assert.doesNotMatch(read(`src/styles/${file}`), /hsl\(var\(--/, file);
  }
  assert.doesNotMatch(read("src/index.css"), /hsl\(var\(--/);
});

test("theme-color and manifest colours follow the ground tokens", () => {
  const [lightGround, darkGround] = spec.ground;
  const html = read("index.html");
  const theme = read("src/contexts/ThemeContext.tsx");
  const vite = read("vite.config.ts");
  const ci = (text: string, value: string) =>
    text.toLowerCase().includes(`"${value.toLowerCase()}"`);

  assert.ok(ci(html, darkGround), "index.html meta theme-color is dark ground");
  assert.ok(ci(html, lightGround), "index.html script sets light ground");
  assert.ok(ci(theme, darkGround) && ci(theme, lightGround), "ThemeContext");
  assert.match(vite, new RegExp(`background_color: "${darkGround}"`, "i"));
  assert.match(vite, new RegExp(`theme_color: "${darkGround}"`, "i"));
  for (const old of ["#0d1016", "#f5f6f9"])
    for (const text of [html, theme, vite])
      assert.equal(text.toLowerCase().includes(old), false, old);
});
