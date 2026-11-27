// P4 Bibliotek och egen övning's own checks (v6 plan, Task 4.11; spec §E).
// The harness has already run the common checks on the five pages and runs
// them again on what this module leaves on screen.
//
// - The tabs read Rutiner, Övningar, Scheman; /library/plan opens Scheman.
// - Övningar: the chip row, "Mina övningar" first, A–Ö in Swedish order.
// - The editor's map: 138 px wide, one side at a time; Fram | Bak flips it;
//   scrolling the level list keeps the map's top constant (sticky), in
//   Enkel and Avancerad.
// - Upptäck: + becomes ✓ and the message appears; "Gör det till ett
//   schema" opens the plan editor with its seven day buttons and the
//   programme's days filled.

const text = (page, selector) =>
  page.evaluate(
    (s) =>
      [...document.querySelectorAll(s)].map((el) =>
        el.textContent.replace(/\s+/g, " ").trim(),
      ),
    selector,
  );

/** The open sheet's scroll box and the map column's top, relative to it. */
const mapTop = (page) =>
  page.evaluate(() => {
    const sheet = document.querySelector(".dialog-content");
    const map = document.querySelector(".muscle-picker-map");
    if (!sheet || !map) return null;
    return Math.round(
      (map.getBoundingClientRect().top - sheet.getBoundingClientRect().top) *
        10,
    ) / 10;
  });

const scrollSheet = (page, by) =>
  page.evaluate((by) => {
    const sheet = document.querySelector(".dialog-content");
    sheet.scrollTop += by;
  }, by);

/** Scrolls until the map column is stuck under the title, then reports it. */
async function stickyCheck(page) {
  for (let i = 0; i < 40; i++) {
    const stuck = await page.evaluate(
      () => !!document.querySelector(".muscle-picker-map.is-stuck"),
    );
    if (stuck) break;
    await scrollSheet(page, 40);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(120);
  const first = await mapTop(page);
  await scrollSheet(page, 120);
  await page.waitForTimeout(160);
  const second = await mapTop(page);
  const stuck = await page.evaluate(
    () => !!document.querySelector(".muscle-picker-map.is-stuck"),
  );
  return { first, second, stuck };
}

module.exports = async ({ page, width, check, shot, visit, common }) => {
  // ---- E1: the tabs and the redirects ----
  await visit("/library");
  const tabs = await text(page, ".library-page > .segmented .seg-option");
  check(
    "Library tabs read Rutiner, Övningar, Scheman",
    tabs.slice(0, 3).join(",") === "Rutiner,Övningar,Scheman",
    tabs.join(","),
  );
  const views = await text(page, ".library-page > .segmented:nth-of-type(2) .seg-option");
  check("Rutiner has Mina | Upptäck", views.join(",") === "Mina,Upptäck", views.join(","));
  await visit("/library/plan");
  check(
    "/library/plan opens Scheman",
    new URL(page.url()).search === "?tab=plans",
    page.url(),
  );
  const planRows = await text(page, ".plans-row .row-title");
  check("Scheman lists the plan", planRows.includes("Styrkeblock"), planRows.join(","));
  const word = await text(page, ".plans-row-word.is-active");
  check("an active plan reads Aktivt", word[0] === "Aktivt", word.join(","));
  await shot("scheman");

  // ---- E1: Övningar ----
  await visit("/library?tab=exercises");
  const groups = await text(page, ".library-page .group-title");
  check(
    "Övningar: Mina övningar first, then A–Ö",
    groups[0] === "Mina övningar" && groups[1] === "A–Ö",
    groups.join(","),
  );
  const chips = await text(page, ".category-chips .filter-chip");
  check("Övningar uses the category chips", chips[0] === "Alla" && chips.at(-1) === "Mina", chips.join(","));
  const names = await page.evaluate(() => {
    const section = [...document.querySelectorAll(".library-page section")].find(
      (s) => s.querySelector(".group-title")?.textContent.trim() === "A–Ö",
    );
    return section
      ? [...section.querySelectorAll(".ex-row-title")]
          .map((el) => el.childNodes[0]?.textContent?.trim() ?? "")
          .filter(Boolean)
      : [];
  });
  const sorted = [...names].sort((a, b) =>
    a.localeCompare(b, "sv", { sensitivity: "base", numeric: true }),
  );
  check(
    "A–Ö is in Swedish order",
    names.length > 20 && names.every((n, i) => n === sorted[i]),
    names.slice(0, 8).join(","),
  );

  // ---- E3/E4: the editor's map ----
  await page.getByRole("button", { name: "Ny övning" }).first().click();
  await page.waitForSelector(".dialog-content .muscle-picker-map", { timeout: 5000 });
  await page.waitForTimeout(500);
  const focused = await page.evaluate(
    () => document.activeElement?.closest(".editor-name") !== null,
  );
  check("the new exercise's name has focus", focused);
  const map = await page.evaluate(() => {
    const svg = document.querySelector(
      ".muscle-picker-map .muscle-map-face.is-shown svg",
    );
    const box = svg?.getBoundingClientRect();
    return box
      ? { width: Math.round(box.width), height: Math.round(box.height), side: svg.dataset.side }
      : null;
  });
  check(
    "the editor map is 138 px wide, one side",
    !!map && Math.abs(map.width - 138) <= 1 && map.side === "front",
    JSON.stringify(map),
  );
  const equipment = await text(page, ".equipment-chips .filter-chip");
  check(
    "Utrustning: seven chips, Hantel chosen",
    equipment.length === 7 &&
      (await page.evaluate(
        () =>
          document
            .querySelector('.equipment-chips [aria-pressed="true"]')
            ?.textContent.trim() === "Hantel",
      )),
    equipment.join(","),
  );
  await shot("editor-enkel");
  await page
    .locator(".muscle-picker-map .segmented")
    .getByRole("radio", { name: "Bak" })
    .click();
  await page.waitForTimeout(400);
  const flipped = await page.evaluate(
    () =>
      document.querySelector(".muscle-picker-map .muscle-map-face.is-shown svg")
        ?.dataset.side,
  );
  check("Fram | Bak flips the map", flipped === "back", String(flipped));
  const simple = await stickyCheck(page);
  check(
    "Enkel: the map's top stays while the levels scroll",
    simple.stuck && simple.first !== null && Math.abs(simple.first - simple.second) <= 1,
    JSON.stringify(simple),
  );
  await page.evaluate(() => {
    document.querySelector(".dialog-content").scrollTop = 0;
  });
  await page
    .locator(".muscle-picker-head .segmented")
    .getByRole("radio", { name: "Avancerad" })
    .click();
  await page.waitForTimeout(300);
  const latin = await text(page, ".muscle-picker-levels .level-row-sub");
  check("Avancerad shows Latin subtitles", latin.includes("rectus abdominis"), latin.slice(0, 3).join(","));
  const advanced = await stickyCheck(page);
  check(
    "Avancerad: the map's top stays while the levels scroll",
    advanced.stuck &&
      advanced.first !== null &&
      Math.abs(advanced.first - advanced.second) <= 1,
    JSON.stringify(advanced),
  );
  await shot("editor-avancerad");
  // A tap on a muscle is a shortcut: Ingen → Mycket.
  await page.evaluate(() => {
    document.querySelector(".dialog-content").scrollTop = 0;
  });
  await page.waitForTimeout(200);
  await page
    .locator(".muscle-picker-map .muscle-map-face.is-shown path[data-muscle]")
    .first()
    .click({ force: true });
  await page.waitForTimeout(200);
  const derived = await text(page, ".editor-derived");
  check("a tap on the map chooses a muscle", /Visas under/.test(derived[0] ?? ""), derived.join(","));
  await common("p4 · editor");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // ---- E6: Upptäck ----
  await visit("/library?view=discover");
  const programs = await text(page, ".program-row .row-title");
  check("Upptäck lists five programmes", programs.length === 5, programs.join(","));
  const add = page.getByRole("button", {
    name: "Lägg till Över/under 4 dagar i Mina rutiner",
  });
  const plus = await add.boundingBox();
  check(
    "the + is round and 44 px",
    !!plus && Math.round(plus.width) >= 44 && Math.round(plus.height) >= 44,
    JSON.stringify(plus),
  );
  await add.click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[aria-label="Lägg till Över/under 4 dagar i Mina rutiner"]')
        ?.getAttribute("aria-pressed") === "true",
    null,
    { timeout: 5000 },
  ).catch(() => {});
  const pressed = await add.getAttribute("aria-pressed");
  const message = await page
    .waitForFunction(
      () =>
        document.body.textContent.includes(
          "4 rutiner från Över/under 4 dagar tillagda i Mina",
        ),
      null,
      { timeout: 3000 },
    )
    .then(() => true)
    .catch(() => false);
  check("+ becomes ✓ and the message appears", pressed === "true" && message, `pressed=${pressed}`);
  const others = await text(page, ".discover-others-row .row-title");
  check("signed out: one row for other lifters' routines", others[0] === "Rutiner från andra lyftare", others.join(","));
  await shot("upptack");
  await common("p4 · Upptäck");

  await page.getByRole("button", { name: "Visa Helkropp A/B" }).click();
  await page.waitForSelector(".program-sheet-body", { timeout: 5000 });
  await page.waitForTimeout(500);
  const range = await text(page, ".program-sets .row-sub");
  check("the programme sheet shows its range", /riktmärke 10–20/.test(range[0] ?? ""), range.join(","));
  const muscles = await page.evaluate(
    () => document.querySelectorAll(".program-sets-row").length,
  );
  check("the programme sheet lists twelve muscles", muscles === 12, String(muscles));
  await shot("program");
  await common("p4 · programme");
  await page.getByRole("button", { name: "Gör det till ett schema" }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".dialog-content .plan-cell").length >= 7,
    null,
    { timeout: 8000 },
  ).catch(() => {});
  await page.waitForTimeout(600);
  const cells = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".dialog-content .plan-grid-row")];
    return rows.map((row) =>
      [...row.querySelectorAll(".plan-cell")].map((cell) =>
        cell.textContent.replace(/\s+/g, " ").trim(),
      ),
    );
  });
  const name = await page.evaluate(
    () => document.querySelector(".dialog-content input")?.value ?? "",
  );
  check(
    "Gör det till ett schema opens the plan editor with seven day buttons filled",
    cells.length === 2 &&
      cells.every((row) => row.length === 7) &&
      cells[0][0] === "Helkropp A" &&
      cells[0][2] === "Helkropp B" &&
      cells[0][4] === "Helkropp A" &&
      cells[1][0] === "Helkropp B" &&
      name === "Helkropp A/B",
    JSON.stringify({ name, cells }),
  );
  check(
    "it opens on Scheman",
    new URL(page.url()).search === "?tab=plans",
    page.url(),
  );
  await shot("plan-from-program");
  void width;
};
