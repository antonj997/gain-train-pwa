// The Playwright verify harness (v6 plan, Task 0.11). It builds the app if
// needed, serves it with `vite preview`, seeds the fixture log on a fixed
// clock and, in Chromium and WebKit at 360, 390 and 1100 px in light and dark
// theme:
//
// 1. visits the five tab pages and runs the common checks on each:
//    - no interactive element under 44 × 44 px;
//    - no text outside 12/13/15/17/20/28 px or 400/600/700;
//    - no horizontal scroll;
//    - no console error;
// 2. runs the phase module (scripts/verify/<phase>.cjs);
// 3. runs the common checks again on what the phase left on screen.
//
// A phase module exports
//   module.exports = async ({ page, engine, width, theme, check, shot,
//                             visit, common }) => { … }
// where check(name, ok, detail?) records a PASS or FAIL, shot(name) saves a
// screenshot, visit(path) opens a page of the seeded app and waits for it,
// and common(label) runs the common checks on the page as it is.
//
// A common-check failure on a page another phase owns can be listed in
// scripts/verify/known.cjs: it then prints as KNOWN with every offender, and
// does not fail the run. Remove the entry when the owner fixes it.
//
// Output: PASS / FAIL / KNOWN lines, screenshots in verify-output/<phase>/,
// exit code 1 on any FAIL.
const { execSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const PORT = 4180;
const BASE = `http://localhost:${PORT}`;

const ENGINES = ["chromium", "webkit"];
const WIDTHS = [360, 390, 1100];
const THEMES = ["light", "dark"];
/** The tab pages every run checks, by their Swedish names. */
const PAGES = [
  { name: "Träna", path: "/" },
  { name: "Kalender", path: "/history" },
  { name: "Framsteg", path: "/progress" },
  { name: "Bibliotek", path: "/library" },
  { name: "Inställningar", path: "/settings" },
];
const TYPE_SIZES = [12, 13, 15, 17, 20, 28];
const TYPE_WEIGHTS = [400, 600, 700];
const TARGET = 44;

function loadPlaywright() {
  const globalRoot = execSync("npm root -g").toString().trim();
  return require(require.resolve("playwright", { paths: [globalRoot, ROOT] }));
}

function get(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode);
    });
    request.on("error", () => resolve(0));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(0);
    });
  });
}

/** Builds dist/ when it is missing (or when asked). */
function ensureBuild(force) {
  if (!force && fs.existsSync(path.join(ROOT, "dist/index.html"))) return;
  console.log("building the app (npm run build)…");
  execSync("npm run build", { cwd: ROOT, stdio: "inherit" });
}

/** Starts `vite preview` on the harness's port and waits until it answers. */
async function startPreview() {
  if ((await get(BASE + "/")) === 200)
    throw new Error(
      `port ${PORT} is already serving; stop that server and run again`,
    );
  const server = spawn(
    "npx",
    ["vite", "preview", "--port", String(PORT), "--strictPort"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], detached: true },
  );
  let log = "";
  server.stdout.on("data", (chunk) => (log += chunk));
  server.stderr.on("data", (chunk) => (log += chunk));
  for (let i = 0; i < 100; i++) {
    if ((await get(BASE + "/")) === 200) return server;
    if (server.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  stopPreview(server);
  throw new Error("vite preview did not start:\n" + log);
}

function stopPreview(server) {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    /* Already gone. */
  }
}

// ---------------------------------------------------------------------------
// The common checks, run inside the page. Each returns its offenders as short
// descriptions; none means the check passes.

/** Interactive elements whose hit area is under 44 × 44 px. */
function smallTargets(min) {
  const selector = [
    "a[href]",
    "button",
    "input:not([type=hidden])",
    "select",
    "textarea",
    "summary",
    "[role=button]",
    "[role=link]",
    "[role=tab]",
    "[role=radio]",
    "[role=switch]",
    "[role=checkbox]",
    "[role=menuitem]",
    "[role=option]",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  const px = (value) => (/^-?[\d.]+px$/.test(value) ? parseFloat(value) : null);
  const describe = (el, w, h) => {
    const text = (el.getAttribute("aria-label") || el.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
    const cls = typeof el.className === "string" ? el.className.trim() : "";
    return `${el.tagName.toLowerCase()}${cls ? "." + cls.split(/\s+/).join(".") : ""} "${text}" ${Math.round(w)}×${Math.round(h)}`;
  };
  const out = [];
  const groups = new Map();
  for (const el of document.querySelectorAll(selector)) {
    if (el.closest("[aria-hidden='true'], [inert]")) continue;
    const style = getComputedStyle(el);
    if (style.visibility !== "visible" || style.display === "none") continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    // Visually hidden (sr-only), so not a target of its own.
    if (box.width <= 2 && box.height <= 2) continue;
    if (el.matches("input") && el.closest("label")) {
      const label = el.closest("label").getBoundingClientRect();
      if (label.width >= min - 0.5 && label.height >= min - 0.5) continue;
    }
    let width = box.width;
    let height = box.height;
    // An invisible extension (a pseudo-element that widens the hit area).
    for (const pseudo of ["::before", "::after"]) {
      const p = getComputedStyle(el, pseudo);
      if (p.content === "none" || p.position !== "absolute") continue;
      const [top, right, bottom, left] = [p.top, p.right, p.bottom, p.left].map(px);
      const pw = px(p.width);
      const ph = px(p.height);
      if (left !== null && right !== null)
        width = Math.max(width, box.width - left - right);
      else if (pw !== null) width = Math.max(width, pw);
      if (top !== null && bottom !== null)
        height = Math.max(height, box.height - top - bottom);
      else if (ph !== null) height = Math.max(height, ph);
    }
    if (width < min - 0.5 || height < min - 0.5) {
      // One line per kind of element and size, with how many there are.
      const line = describe(el, width, height);
      const key = line.replace(/ ".*" /, " ");
      const entry = groups.get(key);
      if (entry) entry.count++;
      else groups.set(key, { line, count: 1 });
    }
  }
  for (const { line, count } of groups.values())
    out.push(count > 1 ? `${line} (+${count - 1} more)` : line);
  return out;
}

/** Visible text whose size or weight is outside the type scale. */
function offScale({ sizes, weights }) {
  const out = [];
  const seen = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    const el = node.parentElement;
    if (!el || el.closest("script, style, noscript, template, title")) continue;
    range.selectNodeContents(node);
    const box = range.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) continue;
    const style = getComputedStyle(el);
    if (style.visibility !== "visible") continue;
    // Clipped to nothing (sr-only).
    const own = el.getBoundingClientRect();
    if (own.width <= 2 && own.height <= 2) continue;
    const size = Math.round(parseFloat(style.fontSize) * 100) / 100;
    const weight = Number(style.fontWeight);
    if (sizes.includes(size) && weights.includes(weight)) continue;
    const text = node.textContent.replace(/\s+/g, " ").trim().slice(0, 30);
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/)[0] : "";
    const parent = el.parentElement;
    const where = cls
      ? ""
      : ` in ${parent?.tagName.toLowerCase() ?? ""}${parent && typeof parent.className === "string" && parent.className.trim() ? "." + parent.className.trim().split(/\s+/)[0] : ""}`;
    const key = `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${where} ${size}/${weight}`;
    const entry = seen.get(key);
    if (entry) entry.count++;
    else seen.set(key, { text, count: 1 });
  }
  for (const [key, { text, count }] of seen)
    out.push(`${key} "${text}"${count > 1 ? ` (+${count - 1} more)` : ""}`);
  return out;
}

/** The page scrolls sideways: what reaches past the viewport. */
function sideways() {
  const root = document.scrollingElement || document.documentElement;
  if (root.scrollWidth <= root.clientWidth + 1) return [];
  const width = root.clientWidth;
  const scrolls = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip")
        return true;
    }
    return false;
  };
  const out = [`page is ${root.scrollWidth}px wide in ${width}px`];
  for (const el of document.body.querySelectorAll("*")) {
    const box = el.getBoundingClientRect();
    if (box.right > width + 1 && box.width > 0 && !scrolls(el)) {
      const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/)[0] : "";
      out.push(`${el.tagName.toLowerCase()}${cls ? "." + cls : ""} right ${Math.round(box.right)}`);
      if (out.length > 6) break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------

function loadKnown() {
  const file = path.join(__dirname, "known.cjs");
  return fs.existsSync(file) ? require(file) : [];
}

function createReport(phase) {
  const known = loadKnown();
  const results = { pass: 0, fail: 0, known: 0 };
  const failures = [];
  const knownLines = [];
  return {
    results,
    failures,
    knownLines,
    /**
     * Records a check. Offenders all matched by known.cjs make it KNOWN;
     * any other offender makes it FAIL.
     */
    record(label, ok, offenders = [], { common = null } = {}) {
      if (ok) {
        results.pass++;
        console.log(`PASS ${label}`);
        return true;
      }
      if (common) {
        const unknown = offenders.filter(
          (o) =>
            !known.some(
              (k) =>
                k.check === common.check &&
                (!k.page || common.page.split(" · ").includes(k.page)) &&
                (!k.width || k.width === common.width) &&
                (!k.match || o.includes(k.match)),
            ),
        );
        if (offenders.length && !unknown.length) {
          results.known++;
          const line = `KNOWN ${label}\n    ${offenders.join("\n    ")}`;
          knownLines.push(line);
          console.log(line);
          return true;
        }
        offenders = unknown;
      }
      results.fail++;
      const line = `FAIL ${label}${offenders.length ? "\n    " + offenders.join("\n    ") : ""}`;
      failures.push(line);
      console.log(line);
      return false;
    },
    phase,
  };
}

/** Seeds the fixture into IndexedDB and localStorage on the app's origin. */
async function seed(page, fixture, theme) {
  // A static file on the origin, so seeding runs before the app does.
  await page.goto(BASE + "/icon.svg");
  await page.evaluate(
    async ({ account, state, local, theme }) => {
      localStorage.clear();
      for (const [key, value] of Object.entries(local))
        localStorage.setItem(key, value);
      localStorage.setItem("gain-train-theme", theme);
      await new Promise((resolve, reject) => {
        const open = indexedDB.open("gain-train-v2", 1);
        open.onupgradeneeded = () => open.result.createObjectStore("accounts");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("accounts", "readwrite");
          tx.objectStore("accounts").clear();
          tx.objectStore("accounts").put(state, account);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    },
    { ...fixture, theme },
  );
}

/** Opens a page of the app and waits until it has rendered and settled. */
async function visit(page, route) {
  await page.goto(BASE + route, { waitUntil: "load" });
  await page.waitForSelector("main .page, main h1", { timeout: 15000 });
  await page
    .waitForFunction(() => !document.querySelector("[data-page-loading]"), null, {
      timeout: 10000,
    })
    .catch(() => {});
  // Reduced motion leaves 120 ms fades; give the stagger and fonts time.
  await page.waitForTimeout(400);
}

async function runCombo({ browser, engine, width, theme, phase, module, fixture, report, outDir }) {
  const context = await browser.newContext({
    viewport: { width, height: width >= 1000 ? 860 : 800 },
    // A phone draws a 1.5 px line as 1.5 px; at 1× Chromium rounds it to 1.
    deviceScaleFactor: width >= 1000 ? 1 : 2,
    locale: "sv-SE",
    timezoneId: "Europe/Stockholm",
    colorScheme: theme,
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const { NOW } = require("./fixture.cjs");
  await page.clock.install({ time: NOW });
  let errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text().slice(0, 200));
  });
  page.on("pageerror", (error) => errors.push(String(error).slice(0, 200)));
  // Nothing leaves the machine: the app runs signed out on the phone log.
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());

  const tag = `${engine} ${width} ${theme}`;
  const shot = async (name) => {
    const file = path.join(outDir, `${engine}-${width}-${theme}-${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
  };
  const common = async (label) => {
    const where = { page: label, width };
    const targets = await page.evaluate(smallTargets, TARGET);
    report.record(`${tag} ${label}: no target under 44 px`, !targets.length, targets, {
      common: { check: "target", ...where },
    });
    const text = await page.evaluate(offScale, { sizes: TYPE_SIZES, weights: TYPE_WEIGHTS });
    report.record(`${tag} ${label}: text on the type scale`, !text.length, text, {
      common: { check: "type", ...where },
    });
    const wide = await page.evaluate(sideways);
    report.record(`${tag} ${label}: no horizontal scroll`, !wide.length, wide, {
      common: { check: "overflow", ...where },
    });
    const logged = errors;
    errors = [];
    report.record(`${tag} ${label}: no console error`, !logged.length, logged, {
      common: { check: "console", ...where },
    });
  };
  const check = (name, ok, detail) =>
    report.record(`${tag} ${name}`, !!ok, detail ? [].concat(detail) : []);

  try {
    await seed(page, fixture, theme);
    errors = [];
    for (const { name, path: route } of PAGES) {
      await visit(page, route);
      await common(name);
      await shot(name);
    }
    if (module) {
      await module({
        page,
        engine,
        width,
        theme,
        check,
        shot,
        visit: (route) => visit(page, route),
        common,
        base: BASE,
      });
      // Named after the page it ended on, so known.cjs entries still apply.
      const ended = new URL(page.url()).pathname;
      const name = PAGES.find((p) => p.path === ended)?.name ?? ended;
      await common(`after ${phase} · ${name}`);
    }
  } catch (error) {
    report.record(`${tag} ${phase} ran to the end`, false, [String(error).slice(0, 400)]);
    await shot("error").catch(() => {});
  } finally {
    await context.close();
  }
}

/**
 * Runs a phase's verification. Options: phase ("p0" …), and to narrow a run
 * engines, widths and themes; build forces a fresh build.
 */
async function run({
  phase,
  engines = ENGINES,
  widths = WIDTHS,
  themes = THEMES,
  build = false,
}) {
  const moduleFile = path.join(__dirname, `${phase}.cjs`);
  const module = fs.existsSync(moduleFile) ? require(moduleFile) : null;
  if (!module) console.log(`(no ${phase}.cjs: the common checks only)`);
  const { build: buildFixture } = require("./fixture.cjs");
  let fixture = buildFixture();
  const extra = path.join(__dirname, `fixture-${phase}.cjs`);
  if (fs.existsSync(extra)) fixture = require(extra)(fixture) ?? fixture;

  const outDir = path.join(ROOT, "verify-output", phase);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  ensureBuild(build);
  const playwright = loadPlaywright();
  const server = await startPreview();
  // Stop the server too when the run is interrupted.
  const interrupted = () => {
    stopPreview(server);
    process.exit(130);
  };
  process.once("SIGINT", interrupted);
  process.once("SIGTERM", interrupted);
  process.once("SIGPIPE", interrupted);
  const report = createReport(phase);
  try {
    for (const engine of engines) {
      let browser;
      try {
        browser = await playwright[engine].launch();
      } catch (error) {
        report.record(`${engine} launches`, false, [
          String(error).split("\n")[0],
          engine === "webkit" ? "run `npx playwright install webkit` once" : "",
        ]);
        continue;
      }
      try {
        for (const width of widths)
          for (const theme of themes)
            await runCombo({ browser, engine, width, theme, phase, module, fixture, report, outDir });
      } finally {
        await browser.close();
      }
    }
  } finally {
    stopPreview(server);
  }
  const { pass, fail, known } = report.results;
  console.log(
    `\n${phase}: ${pass} passed, ${fail} failed, ${known} known` +
      ` · screenshots in ${path.relative(ROOT, outDir)}/`,
  );
  if (report.failures.length) {
    console.log("\nFailures:");
    for (const line of report.failures) console.log(line);
  }
  return fail === 0;
}

module.exports = { run, PAGES, ENGINES, WIDTHS, THEMES, BASE };
