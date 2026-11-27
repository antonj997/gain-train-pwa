import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { customSchema, type CustomExercise } from "../src/data/model.ts";
import { groupMuscles } from "../src/data/exercise-muscles.ts";
import {
  groupChoice,
  levelChoice,
  muscleChoice,
  pickerMuscles,
  withGroupChoice,
  withMuscleChoice,
} from "../src/lib/muscle-picker.ts";
import { loadComponent } from "./helpers/render";

const exercise = (change: Partial<CustomExercise> = {}): CustomExercise => ({
  schemaVersion: 2,
  name: "Landmine Press",
  category: "Shoulders",
  note: "",
  favourite: false,
  ...change,
});

test("levels as the three-way control shows them", () => {
  assert.equal(levelChoice(undefined), "none");
  assert.equal(levelChoice(0), "none");
  assert.equal(levelChoice(0.5), "some");
  assert.equal(levelChoice(1), "much");
  assert.equal(levelChoice("mixed"), "mixed");
});

test("until something is chosen the picker shows the categories' muscles", () => {
  const data = exercise({ categories: ["Chest"] });
  const { muscles, chosen } = pickerMuscles(data);
  assert.equal(chosen, false);
  assert.equal(muscles.frontDelts, 1);
  assert.equal(muscles.chest, 0.5);
  assert.equal(groupChoice(data, "Shoulders"), "much");
  assert.equal(groupChoice(data, "Chest"), "some");
  assert.equal(groupChoice(data, "Legs"), "none");
});

test("the first change writes muscles, starting from what was shown", () => {
  const data = exercise({ categories: ["Chest"] });
  const next = withGroupChoice(data, "Legs", "some");
  for (const muscle of groupMuscles("Legs"))
    assert.equal(next.muscles?.[muscle], 0.5, muscle);
  // The categories' muscles are kept.
  assert.equal(next.muscles?.frontDelts, 1);
  assert.equal(next.muscles?.chest, 0.5);
  assert.equal(pickerMuscles(next).chosen, true);
  // The draft's other fields stay.
  assert.deepEqual(next.categories, ["Chest"]);
});

test("a group whose muscles differ is mixed until a level is chosen", () => {
  let data = withMuscleChoice(exercise(), "sideDelts", "some");
  assert.equal(groupChoice(data, "Shoulders"), "mixed");
  assert.equal(muscleChoice(data, "sideDelts"), "some");
  assert.equal(muscleChoice(data, "frontDelts"), "much");
  data = withGroupChoice(data, "Shoulders", "much");
  assert.equal(groupChoice(data, "Shoulders"), "much");
});

test("choosing none everywhere goes back to the categories", () => {
  let data = withMuscleChoice(exercise({ category: "Other" }), "abs", "much");
  assert.deepEqual(data.muscles, { abs: 1 });
  data = withMuscleChoice(data, "abs", "none");
  assert.equal("muscles" in data, false);
  assert.equal(pickerMuscles(data).chosen, false);
});

test("a saved exercise keeps its muscles and icon", () => {
  const data = withGroupChoice(exercise(), "Arms", "some");
  const saved = customSchema.parse({ ...data, icon: "body" });
  assert.deepEqual(saved.muscles, data.muscles);
  assert.equal(saved.icon, "body");
});

const MusclePicker = await loadComponent(
  "@/components/library/MusclePicker.tsx",
);

const picker = (data: CustomExercise) =>
  renderToStaticMarkup(
    createElement(MusclePicker, { data, onChange: () => {} }),
  );

test("the picker: a map, the seven groups and the line on the category", () => {
  const html = picker(exercise({ categories: ["Chest"] }));
  assert.match(html, /class="muscle-map muscle-map-preview"/);
  assert.equal(html.split('class="level-row"').length - 1, 7);
  // v6: no icon tiles; the equipment sets the icon (the editor's chips).
  assert.doesNotMatch(html, /icon-choice/);
  // The category the muscles give.
  assert.match(html, /class="editor-derived"/);
  assert.match(html, /<b>(Shoulders|Axlar)<\/b>/);
});

test("with no muscles chosen the line says how the group is picked; a mixed group says so", () => {
  const empty = picker(exercise({ category: "Other" }));
  assert.match(empty, /(Choose muscles|Välj muskler)\. /);
  const data = withMuscleChoice(exercise(), "sideDelts", "some");
  assert.match(picker(data), /class="level-row-mixed"/);
});
