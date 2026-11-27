// P1 Passet's own checks (v6 plan, Task 1.13), on the running workouts the
// fixture holds (fixture.cjs, fixture-p1.cjs):
//
// - the pad and RIR: RIR mode is exactly as tall as the kg pad (decision 5);
//   the slider follows ArrowRight, Home and End in aria-valuetext;
// - the set row: the RIR box only with "gt-ask-rir"; a swipe removes a set
//   with no Ångra; a tap on a checked set shows the toast and moves no row;
// - coach and drops: the B13 fatigue row lowers to 20 and folds; "+ Drop"
//   adds 40 after 50;
// - finishing: nothing checked opens "Inga set är ikryssade"; all checked
//   gives Avsluta its fill.
//
// The heavy interactions run once per engine (390 px, light); the rest in
// every combination. The common checks run on the workout screen with the
// pad open and in RIR mode too.
const { uuid } = require("./fixture.cjs");
const { P1 } = require("./fixture-p1.cjs");

const MAIN = uuid(5);
const settle = (page, ms = 350) => page.waitForTimeout(ms);

module.exports = async ({ page, width, theme, check, shot, visit, common }) => {
  const full = width === 390 && theme === "light";

  // ---- The workout screen as it opens ----
  await visit(`/workout/${MAIN}`);
  check(
    "the exercise heading names the equipment and its step",
    await page.evaluate(() =>
      [...document.querySelectorAll(".ex-meta")].some((el) =>
        /±/.test(el.textContent),
      ),
    ),
  );
  check(
    "no RIR box while RIR is off",
    (await page.locator(".set-rir-box").count()) === 0,
  );
  await common("Passet");
  await shot("passet");

  // ---- The pad: kg mode, then RIR mode, the same height ----
  await page.evaluate(() => localStorage.setItem("gt-ask-rir", "true"));
  await visit(`/workout/${MAIN}`);
  check(
    "the RIR box shows with gt-ask-rir",
    (await page.locator(".set-rir-box").count()) > 0,
  );
  // The squat's first open set: its kg field opens the pad.
  const openRow = page.locator(".set-line:not(.is-done)").first();
  await openRow.locator('[data-pad-field="weight"]').click();
  await page.waitForSelector(".number-pad-grid");
  await settle(page, 500);
  const padHeight = () =>
    page.evaluate(
      () =>
        document.querySelector(".workout-dock-pad")?.getBoundingClientRect()
          .height ?? -1,
    );
  const kgHeight = await padHeight();
  await common("Passet · plattan");
  await shot("plattan-kg");
  await page
    .locator('.number-pad .segmented [role="radio"]', { hasText: "RIR" })
    .click();
  await page.waitForSelector(".rir-track");
  await settle(page, 300);
  const rirHeight = await padHeight();
  check(
    "the pad in RIR mode is exactly as tall as in kg mode (decision 5)",
    kgHeight > 0 && rirHeight === kgHeight,
    `kg ${kgHeight}px, RIR ${rirHeight}px`,
  );
  await common("Passet · RIR");
  await shot("plattan-rir");
  const track = page.locator(".rir-track");
  await track.focus();
  const valueText = () => track.getAttribute("aria-valuetext");
  const unset = await valueText();
  await page.keyboard.press("ArrowRight");
  const right = await valueText();
  await page.keyboard.press("Home");
  const home = await valueText();
  await page.keyboard.press("End");
  const end = await valueText();
  check(
    "the RIR slider follows ArrowRight, Home and End in aria-valuetext",
    unset === "Inte valt" &&
      right === "2 reps kvar" &&
      home === "0, max" &&
      end === "5 eller fler, lätt",
    JSON.stringify({ unset, right, home, end }),
  );
  await page.keyboard.press("Escape");
  await settle(page, 400);

  if (full) {
    // ---- A tap on a checked set: the toast, and no row moves ----
    const checked = page.locator(".set-line.is-done").first();
    const below = page.locator(".set-line").nth(1);
    const before = await below.evaluate((el) => el.getBoundingClientRect().top);
    await checked.locator('[data-pad-field="weight"], input').first().click();
    await settle(page, 300);
    const toast = await page
      .locator(".workout-toast")
      .textContent()
      .catch(() => "");
    const after = await below.evaluate((el) => el.getBoundingClientRect().top);
    check(
      "the first tap on a checked set shows the toast",
      /Setet är klart\. Kryssa ur ✓ för att ändra värdena\./.test(toast ?? ""),
      toast,
    );
    check("no row moves when the toast shows", before === after, `${before} → ${after}`);

    // ---- "+ Drop" after 50 adds 40 ----
    const calf = page.locator(".ex-card", { hasText: "Stående vadpress" });
    const plusDrop = calf.locator(".ex-add-drop");
    check("+ Drop shows once the exercise has a drop", (await plusDrop.count()) === 1);
    await plusDrop.click();
    await settle(page, 600);
    const drops = await calf
      .locator(".set-line.is-drop input[data-pad-field='weight']")
      .evaluateAll((els) => els.map((el) => el.value));
    check(
      '"+ Drop" adds 40 after 50',
      drops.join(",") === "50,40",
      drops.join(","),
    );
    await page.keyboard.press("Escape");
    await settle(page);

    // ---- A swipe deletes the last set at once, with no Ångra ----
    const rows = calf.locator(".set-swipe");
    const count = await rows.count();
    const target = calf
      .locator(".set-swipe")
      .filter({ hasNot: page.locator(".is-drop") })
      .nth(1);
    const box = await target.boundingBox();
    if (box) {
      const y = box.y + box.height / 2;
      await page.mouse.move(box.x + box.width - 20, y);
      await page.mouse.down();
      for (let i = 1; i <= 12; i++)
        await page.mouse.move(box.x + box.width - 20 - i * 25, y);
      await page.mouse.up();
    }
    await settle(page, 1200);
    const left = await calf.locator(".set-swipe").count();
    const undo = await page.getByText("Ångra").count();
    check(
      "a swipe removes the set and offers no Ångra",
      left < count && undo === 0,
      `${count} → ${left} rows, ${undo} Ångra`,
    );
    await shot("svep");
  }

  // ---- B13: the fatigue row ----
  await page.evaluate(() => localStorage.removeItem("gt-ask-rir"));
  await visit(`/workout/${P1.b13}`);
  const row = page.locator(".fatigue-row");
  check(
    "the B13 fixture shows the fatigue row",
    (await row.count()) === 1 &&
      /Framsida lår har redan fått 6 hårda set i dag/.test(
        (await row.textContent()) ?? "",
      ),
    await row.textContent().catch(() => ""),
  );
  await shot("b13");
  if (full) {
    await row.getByRole("button", { name: "Sänk till 20 × 8" }).click();
    await settle(page, 700);
    const split = page.locator(".ex-card", { hasText: "Bulgarisk utfallsböj" });
    const weights = await split
      .locator("input[data-pad-field='weight']")
      .evaluateAll((els) => els.map((el) => el.value));
    const rowGone = await page.evaluate(() => {
      const el = document.querySelector(".fatigue-row");
      return !el || el.getBoundingClientRect().height === 0;
    });
    check(
      "Sänk changes the fields to 20 and the row folds to 0",
      weights.length === 3 && weights.every((w) => w === "20") && rowGone,
      JSON.stringify({ weights, rowGone }),
    );
  }

  // ---- Finishing ----
  await visit(`/workout/${P1.empty}`);
  await page.getByRole("button", { name: "Avsluta", exact: true }).click();
  await page.waitForSelector('[role="dialog"]');
  await settle(page, 400);
  check(
    'finishing with nothing checked opens "Inga set är ikryssade"',
    (await page.getByRole("heading", { name: "Inga set är ikryssade" }).count()) === 1,
  );
  await common("Passet · avsluta tomt");
  await shot("avsluta-tomt");
  await page.getByRole("button", { name: "Fortsätt passet" }).click();
  await settle(page, 500);
  const checks = page.locator(".set-check");
  const n = await checks.count();
  for (let i = 0; i < n; i++) {
    await checks.nth(i).click();
    await settle(page, 250);
  }
  await settle(page, 400);
  const ready = await page.evaluate(
    () =>
      !!document.querySelector("button.finish-ready[data-ready]") &&
      !document.querySelector("button.finish-pending"),
  );
  check("with all sets checked, Avsluta has the gradient class", ready);
  await shot("alla-klara");
  // End where the common checks run once more: the workout screen.
};
