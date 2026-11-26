// P0 Grunden's own checks (v6 plan, Task 0.11). The harness has already run
// the common checks (44 px targets, the type scale, no sideways scroll, no
// console error) on Träna, Kalender, Framsteg, Bibliotek and Inställningar.

/** Resolves a colour expression to the computed rgb() the page would draw. */
const resolveColour = (page, expression, inside) =>
  page.evaluate(
    ({ expression, inside }) => {
      const host = (inside && document.querySelector(inside)) || document.body;
      const probe = document.createElement("span");
      probe.style.backgroundColor = expression;
      host.appendChild(probe);
      const value = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return value;
    },
    { expression, inside },
  );

/**
 * The selected look's 1.5 px line as the engine draws it: WebKit keeps
 * 1.5px; Chromium snaps line widths to whole CSS pixels (1px). The CSS itself
 * is pinned by tests/ui-primitives.test.ts.
 */
const lineOk = (width) => width === "1.5px" || width === "1px";

module.exports = async ({ page, engine, width, theme, check, shot, visit, base }) => {
  const sel = {
    bg: await resolveColour(page, "var(--gt-sel-bg)"),
    line: await resolveColour(page, "var(--gt-sel-line)"),
    ink: await resolveColour(page, "var(--gt-sel-ink)"),
  };

  // H1: the pressed Segmented option (Library's Rutiner | Övningar).
  await visit("/library");
  const segment = await page.evaluate(() => {
    const thumb = document.querySelector(".segmented-thumb");
    const option = document.querySelector('.segmented [aria-checked="true"]');
    if (!thumb || !option) return null;
    const t = getComputedStyle(thumb);
    return {
      bg: t.backgroundColor,
      border: t.borderTopWidth,
      line: t.borderTopColor,
      ink: getComputedStyle(option).color,
    };
  });
  check(
    "pressed Segmented uses sel tokens",
    segment &&
      segment.bg === sel.bg &&
      segment.line === sel.line &&
      segment.ink === sel.ink &&
      lineOk(segment.border),
    JSON.stringify({ segment, sel }),
  );

  // H1: the pressed filter chip (Library → Övningar, "Alla").
  await visit("/library?tab=exercises");
  const chip = await page.evaluate(() => {
    const el = document.querySelector('.filter-chip[aria-pressed="true"]');
    if (!el) return null;
    const s = getComputedStyle(el);
    return {
      bg: s.backgroundColor,
      border: s.borderTopWidth,
      line: s.borderTopColor,
      ink: s.color,
      height: el.getBoundingClientRect().height,
    };
  });
  check(
    "pressed filter chip uses sel tokens",
    chip &&
      chip.bg === sel.bg &&
      chip.line === sel.line &&
      chip.ink === sel.ink &&
      lineOk(chip.border) &&
      chip.height >= 44,
    JSON.stringify({ chip, sel }),
  );

  // H4: 44 px avatars with the figure or glyph inside.
  const avatar = await page.evaluate(() => {
    const el = document.querySelector(".ex-avatar");
    if (!el) return null;
    const box = el.getBoundingClientRect();
    const svg = el.querySelector("svg");
    return {
      width: box.width,
      height: box.height,
      svg: svg ? Number(svg.getAttribute("width")) : 0,
    };
  });
  check(
    "exercise avatars are 44 px circles with a 34 px figure or 24 px glyph",
    avatar &&
      avatar.width === 44 &&
      avatar.height === 44 &&
      [34, 24].includes(avatar.svg),
    JSON.stringify(avatar),
  );

  // D2: Swedish display names (the records keep their English names).
  const names = await page.evaluate(() =>
    [...document.querySelectorAll(".ex-row-title")].map((el) => el.textContent),
  );
  check(
    "Library lists built-in exercises by their Swedish names",
    names.some((n) => n.startsWith("Bänkpress")) &&
      names.some((n) => n.startsWith("Knäböj")) &&
      !names.some((n) => n.startsWith("Bench Press")),
    names.slice(0, 8).join(", "),
  );
  await shot("Bibliotek-ovningar");

  // H4: every tab shows its name, 12/600, on an opaque bar.
  await visit("/");
  const nav = await page.evaluate(() => {
    const bar = document.querySelector(".bottom-nav");
    if (!bar) return null;
    const labels = [...bar.querySelectorAll(".nav-tab-label")].map((el) => {
      const s = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return {
        text: el.textContent,
        visible: box.width > 2 && box.height > 2 && s.visibility === "visible" && Number(s.opacity) === 1,
        size: s.fontSize,
        weight: s.fontWeight,
      };
    });
    const tabs = [...bar.querySelectorAll(".nav-tab")].map((el) => {
      const box = el.getBoundingClientRect();
      return Math.min(box.width, box.height);
    });
    return { labels, tabs, background: getComputedStyle(bar).backgroundColor };
  });
  check(
    "the tab bar shows Träna, Kalender, Framsteg and Bibliotek",
    nav &&
      nav.labels.map((l) => l.text).join(",") ===
        "Träna,Kalender,Framsteg,Bibliotek" &&
      nav.labels.every((l) => l.visible && l.size === "12px" && l.weight === "600"),
    JSON.stringify(nav?.labels),
  );
  check(
    "the tab bar is opaque and its tabs are 44 px or more",
    nav &&
      /^rgb\(/.test(nav.background) &&
      nav.tabs.length === 4 &&
      nav.tabs.every((size) => size >= 44),
    JSON.stringify({ background: nav?.background, tabs: nav?.tabs }),
  );
  check(
    "Train's running workout names the next set in Swedish",
    await page.evaluate(() => document.body.textContent.includes("Knäböj")),
  );

  // F-P1.3: a new user's language follows the phone; nothing is stored until
  // they choose. Once per engine, in a fresh context with no log.
  if (width === 390 && theme === "light") {
    const browser = page.context().browser();
    for (const [locale, lang, title] of [
      ["sv-SE", "sv", /Träna/],
      ["en-GB", "en", /Train/],
    ]) {
      const context = await browser.newContext({
        locale,
        serviceWorkers: "block",
        reducedMotion: "reduce",
        viewport: { width: 390, height: 800 },
      });
      const fresh = await context.newPage();
      await fresh.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
      await fresh.goto(base + "/");
      await fresh.waitForSelector("main .page, main h1", { timeout: 15000 });
      await fresh.waitForTimeout(300);
      const seen = await fresh.evaluate(() => ({
        lang: document.documentElement.lang,
        stored: localStorage.getItem("gt-language"),
        nav: document.querySelector(".bottom-nav")?.textContent ?? "",
        prompt: !!document.querySelector('[role="dialog"]'),
      }));
      check(
        `a new user on a ${locale} phone gets ${lang}, nothing chosen, no prompt`,
        seen.lang === lang &&
          title.test(seen.nav) &&
          seen.stored !== "sv" &&
          seen.stored !== "en" &&
          !seen.prompt,
        JSON.stringify(seen),
      );
      await context.close();
    }
  }
};
