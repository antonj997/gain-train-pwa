// P5 Inställningar's own checks (v6 plan, Task 5.4; spec §G1). The harness
// has already run the common checks on the five pages, Inställningar
// included, and runs them again on what this module leaves on screen.
//
// - The groups, in the owner's order.
// - Every switch is a full row at least 44 px high, also with the rest
//   timer's Ljud and Vibrera open.
// - Vilotimer: off for this (new) phone; on shows Ljud and Vibrera.
// - Coach: Föreslå by default; Av saves gt-fatigue-mode.
// - Tema: "Följ telefonen igen" clears a choice; a tap on the row's text
//   (not the drawn switch) switches the theme, and the text and the surface
//   fade together, sampled from the frame the theme class lands (0, 325 and
//   650 ms) with motion on. R9 was WebKit's row titles vanishing here.

/** Every [role=switch] on Settings: its size against its list's width. */
const switchRows = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.settings-page [role="switch"]')]
      .filter((el) => el.getBoundingClientRect().height > 0)
      .map((el) => {
        const box = el.getBoundingClientRect();
        const list = el.closest(".list")?.getBoundingClientRect();
        const name = (el.getAttribute("aria-label") || el.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 30);
        return {
          name,
          width: Math.round(box.width),
          height: Math.round(box.height),
          list: list ? Math.round(list.width) : 0,
        };
      }),
  );
/**
 * A full row: at least 44 px high and across its list, less the row's side
 * padding (16 px each side, 24 more for a row indented under its switch).
 */
const fullRows = (rows) =>
  rows.length > 0 &&
  rows.every((r) => r.height >= 44 && r.list > 0 && r.width >= r.list - 58);

const groupTitles = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll(".settings-page .group-title")].map((h) =>
      h.textContent.trim(),
    ),
  );

const switchNamed = (page, name) =>
  page.locator('.settings-page [role="switch"]', { hasText: name }).first();

/** "rgb(…)", "rgba(…)" or "color(srgb …)" as 0–255 channels. */
function channels(colour) {
  const numbers = (colour.match(/[\d.]+/g) || []).map(Number);
  const rgb = colour.startsWith("color(")
    ? numbers.slice(0, 3).map((v) => v * 255)
    : numbers.slice(0, 3);
  return rgb;
}
const distance = (a, b) =>
  Math.hypot(...channels(a).map((v, i) => v - channels(b)[i]));
/** How far a colour has come from `from` towards `to`, 0–1. */
const progress = (from, to, now) => {
  const whole = distance(from, to);
  return whole < 1 ? 1 : Math.min(1, distance(from, now) / whole);
};

module.exports = async ({ page, engine, theme, check, shot, visit, common }) => {
  await visit("/settings");

  // §G1: the groups between the account row and Data, Hjälp and Konto.
  const titles = await groupTitles(page);
  check(
    "Settings groups are Utseende, Vilotimer, Loggning, Coach, Träning, Allmänt, then Data, Hjälp, Konto",
    JSON.stringify(titles) ===
      JSON.stringify([
        "Utseende",
        "Vilotimer",
        "Loggning",
        "Coach",
        "Träning",
        "Allmänt",
        "Din data",
        "Hjälp och feedback",
        "Konto",
      ]),
    titles.join(", "),
  );

  let rows = await switchRows(page);
  check(
    "all switches are full rows ≥ 44 px",
    fullRows(rows),
    rows.map((r) => `${r.name} ${r.width}×${r.height} in ${r.list}`),
  );

  // Vilotimer: off for a phone that never saved a rest time (decision 4).
  const rest = switchNamed(page, "Vilotimer");
  const soundRow = () => switchNamed(page, "Ljud när vilan är slut").count();
  const vibrateRow = () =>
    page
      .locator('.settings-page [role="switch"]')
      .filter({ hasText: /^Vibrera$/ })
      .count();
  check(
    "the rest timer is off for a new phone, without Ljud and Vibrera",
    (await rest.getAttribute("aria-checked")) === "false" &&
      (await soundRow()) === 0 &&
      (await vibrateRow()) === 0,
  );
  await rest.click();
  await page.waitForTimeout(400);
  // iPhone Safari cannot vibrate, so WebKit has no Vibrera row.
  const canVibrate = await page.evaluate(
    () => typeof navigator.vibrate === "function",
  );
  const restOn = await page.evaluate(() => localStorage.getItem("gt-rest-on"));
  check(
    "switched on, Ljud and Vibrera show under the rest timer",
    (await rest.getAttribute("aria-checked")) === "true" &&
      restOn === "true" &&
      (await soundRow()) === 1 &&
      (await vibrateRow()) === (canVibrate ? 1 : 0),
    JSON.stringify({ restOn, canVibrate }),
  );
  rows = await switchRows(page);
  check(
    "with the rest timer on, all switches are full rows ≥ 44 px",
    fullRows(rows),
    rows.map((r) => `${r.name} ${r.width}×${r.height} in ${r.list}`),
  );
  await common("Inställningar · vilotimer på");
  await shot("Installningar-vilotimer-pa");
  await rest.click();
  await page.waitForTimeout(400);
  check(
    "switched off again, Ljud and Vibrera fold away",
    (await rest.getAttribute("aria-checked")) === "false" &&
      (await soundRow()) === 0,
  );

  // Coach: Föreslå by default (decision 2); Av is saved.
  const fatigue = page.locator(
    '[role="radiogroup"][aria-label="Trött muskel sent i passet"]',
  );
  const pressed = () =>
    fatigue.locator('[aria-checked="true"]').first().textContent();
  const before = await pressed();
  await fatigue.getByRole("radio", { name: "Av" }).click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("gt-fatigue-mode"),
  );
  check(
    "Trött muskel sent i passet: Föreslå by default, Av saves off",
    before === "Föreslå" && (await pressed()) === "Av" && saved === "off",
    JSON.stringify({ before, saved }),
  );
  await fatigue.getByRole("radio", { name: "Föreslå" }).click();

  // Tema: the run saved this theme, so it is a choice by hand.
  const row = page.locator(".theme-row");
  const value = () => row.locator(".row-sub").textContent();
  const named = theme === "dark" ? "Mörkt" : "Ljust";
  const follow = page.getByRole("button", { name: "Följ telefonen igen" });
  check(
    "a chosen theme names itself and offers Följ telefonen igen",
    (await value()) === named && (await follow.count()) === 1,
    await value(),
  );
  await follow.click();
  await page.waitForTimeout(400);
  const stored = await page.evaluate(() =>
    localStorage.getItem("gain-train-theme"),
  );
  const phone = `Följer telefonen (${theme === "dark" ? "mörkt" : "ljust"} nu)`;
  check(
    "Följ telefonen igen clears the choice and follows the phone",
    stored === null &&
      (await value()) === phone &&
      (await follow.count()) === 0,
    JSON.stringify({ stored, value: await value() }),
  );

  // The fade, with motion on: tap the row's title, not the drawn switch.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const samples = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const root = document.documentElement;
        const title = document.querySelector(".theme-row .row-title");
        const other = document.querySelector(
          ".settings-page .rest-setting .switch-label",
        );
        const list = document.querySelector(".theme-row").closest(".list");
        const read = () => ({
          title: getComputedStyle(title).color,
          other: getComputedStyle(other).color,
          surface: getComputedStyle(list).backgroundColor,
          ground: getComputedStyle(document.body).backgroundColor,
        });
        const dark = root.classList.contains("dark");
        const start = read();
        const frames = [];
        let landed = null;
        const t0 = performance.now();
        const tick = () => {
          const now = performance.now();
          if (landed === null && root.classList.contains("dark") !== dark)
            landed = now;
          frames.push({ t: now, ...read() });
          if (now - t0 < 1500) requestAnimationFrame(tick);
          else resolve({ start, frames, landed, t0, dark });
        };
        title.click();
        requestAnimationFrame(tick);
      }),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { start, frames, landed } = samples;
  const end = frames[frames.length - 1];
  const at = (ms) =>
    frames.reduce((best, f) =>
      Math.abs(f.t - (landed + ms)) < Math.abs(best.t - (landed + ms))
        ? f
        : best,
    );
  const parts = ["title", "other", "surface", "ground"];
  const fade = [0, 325, 650].map((ms) => {
    const f = at(ms);
    return {
      ms,
      ...Object.fromEntries(
        parts.map((p) => [p, +progress(start[p], end[p], f[p]).toFixed(2)]),
      ),
    };
  });
  const themeNow = await page.evaluate(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );
  check(
    "a tap on the Tema row's text switches the theme",
    landed !== null &&
      themeNow !== theme &&
      (await row.getAttribute("aria-checked")) ===
        String(themeNow === "light") &&
      (await value()) === (themeNow === "dark" ? "Mörkt" : "Ljust"),
    JSON.stringify({ themeNow, value: await value() }),
  );
  const [first, middle, last] = fade;
  const together = (f) =>
    Math.max(...parts.map((p) => f[p])) - Math.min(...parts.map((p) => f[p]));
  check(
    `${engine}: text and surface fade together over 650 ms (0, 325, 650 ms)`,
    landed !== null &&
      parts.every((p) => first[p] <= 0.25) &&
      parts.every((p) => middle[p] >= 0.15 && middle[p] <= 0.85) &&
      together(middle) <= 0.3 &&
      parts.every((p) => last[p] >= 0.9) &&
      parts.every((p) => distance(end[p], start[p]) > 50),
    JSON.stringify(fade),
  );
  await page.waitForTimeout(300);
  await shot("Installningar-tema");
};
