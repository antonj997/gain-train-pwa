// P2 Kalender, Träna och schemats kalender: its own checks (v6 plan, Task
// 2.11). The harness has already run the common checks on the five pages and
// runs them again on what this module leaves on screen (the plan status page,
// named after its path).
//
// - Träna: the week strip's days are at least 44 px; Tuesday's moved badge
//   (Monday's Tryckpass, moved and done on Tuesday) sits top-left with its
//   arrow pointing right; the legend says "Flyttat hit från mån".
// - Kalender: a tap on a compact square changes neither the URL nor opens a
//   sheet; a hold and drag along one row selects a weekday across weeks;
//   today's square has a 4 px dot in its middle.
// - Plan calendars: the new plan's whole period has 2 px between rows; plan
//   status shows "fullföljda" with the period calendar.
const { ids } = require("./fixture.cjs");

/** The page's text, spaces folded. */
const text = (page, selector = "main") =>
  page.evaluate(
    (s) => (document.querySelector(s)?.textContent ?? "").replace(/\s+/g, " "),
    selector,
  );

module.exports = async ({ page, check, shot, visit }) => {
  // ---- Träna: the week strip (A2).
  await visit("/");
  const strip = await page.evaluate(() => {
    const cells = [...document.querySelectorAll(".week-days .day-cell")].map(
      (el) => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height };
      },
    );
    const tuesday = document.querySelector(
      '.week-days [data-date="2026-11-17"] .day-cell',
    );
    const badge = tuesday?.querySelector(".moved-badge");
    const cell = tuesday?.getBoundingClientRect();
    const b = badge?.getBoundingClientRect();
    const path = badge?.querySelector("path");
    return {
      cells,
      badge: badge
        ? {
            className: badge.className,
            leftOfCentre: b.left + b.width / 2 < cell.left + cell.width / 2,
            atTop: b.top < cell.top + 4,
            width: Math.round(b.width),
            mirrored: !!path?.getAttribute("transform"),
            stroke: badge.querySelector("svg")?.getAttribute("stroke-width"),
          }
        : null,
      legend: document.querySelector(".week-legend")?.textContent ?? "",
      heading: document.querySelector(".week-card-title")?.textContent ?? "",
    };
  });
  check(
    "Träna: every day in the week strip is at least 44 px tall",
    strip.cells.length === 7 && strip.cells.every((c) => c.h >= 44 - 0.5),
    JSON.stringify(strip.cells),
  );
  check(
    "Träna: Tuesday's moved badge sits top-left, 20 px, its arrow pointing right",
    strip.badge &&
      strip.badge.className.includes("is-left") &&
      strip.badge.leftOfCentre &&
      strip.badge.atTop &&
      strip.badge.width === 20 &&
      !strip.badge.mirrored &&
      strip.badge.stroke === "3",
    JSON.stringify(strip.badge),
  );
  check(
    "Träna: the legend reads Gjort · Planerat · I dag · Flyttat hit från mån",
    /Gjort.*Planerat.*I dag.*Flyttat hit från mån/.test(strip.legend),
    strip.legend,
  );
  check(
    "Träna: the head is one week reference, Den här veckan · 1 av 2 pass",
    strip.heading === "Den här veckan · 1 av 2 pass",
    strip.heading,
  );
  await shot("p2-trana");

  // ---- Kalender: the compact calendar (C1).
  await visit("/history");
  const square = (date) =>
    page.locator(`.calendar-heatmap .heatmap-day[data-date="${date}"]`);
  const before = page.url();
  const tapBox = await square("2026-11-12").boundingBox();
  await page.mouse.click(tapBox.x + 6, tapBox.y + 6);
  await page.waitForTimeout(400);
  const afterTap = await page.evaluate(() => ({
    dialog: !!document.querySelector('[role="dialog"]'),
    selected: document.querySelectorAll(".heatmap-day.is-selected").length,
    buttons: document.querySelectorAll(".calendar-heatmap button.heatmap-day")
      .length,
  }));
  check(
    "Kalender: a tap on a compact square changes neither the URL nor opens a sheet",
    page.url() === before &&
      !afterTap.dialog &&
      afterTap.selected === 0 &&
      afterTap.buttons === 0,
    JSON.stringify({ url: page.url(), ...afterTap }),
  );

  const dot = await page.evaluate(() => {
    const el = document.querySelector(
      '.calendar-heatmap .heatmap-day[data-date="2026-11-19"]',
    );
    if (!el) return null;
    const box = el.getBoundingClientRect();
    const after = getComputedStyle(el, "::after");
    const px = (v) => parseFloat(v) || 0;
    const left = px(after.left) + px(after.marginLeft);
    const top = px(after.top) + px(after.marginTop);
    const w = px(after.width);
    const h = px(after.height);
    return {
      w,
      h,
      dx: Math.abs(left + w / 2 - box.width / 2),
      dy: Math.abs(top + h / 2 - box.height / 2),
      ring: getComputedStyle(el).boxShadow,
      content: after.content,
    };
  });
  check(
    "Kalender: today's square has a centred 4 px dot and no ring",
    dot &&
      dot.w === 4 &&
      dot.h === 4 &&
      dot.dx <= 0.5 &&
      dot.dy <= 0.5 &&
      !/rgb/.test(dot.ring) &&
      dot.content !== "none",
    JSON.stringify(dot),
  );

  // Hold on Monday 26 Oct, drag along the Monday row to Monday 16 Nov.
  const from = await square("2026-10-26").boundingBox();
  const to = await square("2026-11-16").boundingBox();
  await page.mouse.move(from.x + 6, from.y + 6);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.move((from.x + to.x) / 2 + 6, from.y + 6, { steps: 4 });
  await page.mouse.move(to.x + 6, to.y + 6, { steps: 4 });
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page.waitForTimeout(400);
  const caption = await text(page, ".period-summary");
  check(
    "Kalender: a hold and drag along one row selects Måndagar, 26 okt – 16 nov · 4 veckor",
    /Måndagar, 26 okt – 16 nov/.test(caption) && /4 veckor/.test(caption),
    caption,
  );
  await shot("p2-kalender-drag");

  // ---- F1: the new plan's whole period, 2 px between rows.
  await visit("/library/plan");
  await page.getByRole("button", { name: "Nytt schema" }).first().click();
  await page.waitForSelector(".plan-period-card .heatmap-grid", {
    timeout: 5000,
  });
  await page.waitForTimeout(400);
  const f1 = await page.evaluate(() => {
    const grid = document.querySelector(".plan-period-card .heatmap-grid");
    const days = [...grid.querySelectorAll(".heatmap-day")];
    const a = days[0].getBoundingClientRect();
    const b = days[1].getBoundingClientRect();
    return {
      rowGap: getComputedStyle(grid).rowGap,
      gap: Math.round((b.top - a.bottom) * 10) / 10,
      line: document.querySelector(".plan-period-line")?.textContent ?? "",
      deload: document.querySelector(
        '.plan-field [role="radiogroup"] [aria-checked="true"]',
      )?.textContent,
    };
  });
  check(
    "F1: the whole period's rows are 2 px apart",
    f1.rowGap === "2px" && f1.gap === 2,
    JSON.stringify(f1),
  );
  check(
    "F1: an 8-week plan defaults to the 7 + 1 deload, and the period line follows",
    f1.deload === "7 + 1" && /^\d+ \w+ – \d+ \w+ · \d+ pass/.test(f1.line),
    JSON.stringify(f1),
  );
  await shot("p2-nytt-schema");

  // ---- F2: plan status, the period calendar and week-based adherence.
  await visit(`/library/plan/${ids.plan}`);
  const f2 = await text(page);
  const f2cal = await page.evaluate(
    () => !!document.querySelector(".plan-period-top .period-calendar"),
  );
  check(
    'F2: plan status shows "fullföljda" and the period calendar',
    /veckor fullföljda/.test(f2) && /Nästa pass · i dag/.test(f2) && f2cal,
    f2.slice(0, 300),
  );
  await shot("p2-schemastatus");
};
