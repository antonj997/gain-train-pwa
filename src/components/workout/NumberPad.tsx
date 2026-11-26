import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import { Check, ChevronRight, Delete } from "lucide-react";
import type { Workout, WorkoutSet } from "@/data/model";
import { labelSet } from "@/data/model";
import { dropGroup, isDrop, setBadge } from "@/data/drops";
import { previousResult, type LastSession } from "@/data/workouts";
import { groupComplete } from "@/lib/workout-editor";
import { changeSetNumber, getSetInputText } from "@/lib/set-input";
import {
  dropMinus20,
  padAfterCheck,
  padHint,
  padKeyFor,
  padFields,
  padFormat,
  padKeyPresses,
  padNext,
  padStepLabel,
  padText,
  padValue,
  pressPadKey,
  stepPadValue,
  type PadField,
  type PadKey,
  type PadKeyField,
  type PadTarget,
} from "@/lib/number-pad";
import { motionMs } from "@/lib/slow-motion";
import { fromUnit, toUnit, type WeightUnit } from "@/lib/units";
import { fillFrom, type FillSource } from "@/lib/set-target";
import { formatDecimal } from "@/i18n";
import { useT } from "@/i18n/useT";
import { SPRING, playSpring } from "@/lib/motion";
import { primeRestSound } from "@/lib/rest-sound";
import Segmented from "@/components/ui/Segmented";
import { playStep } from "@/components/workout/set-motion";
import { exerciseDisplayName } from "@/lib/exercise-name";
import { rirOf, withRir } from "@/lib/rir";
import RirSlider from "@/components/workout/RirSlider";

/** How long a key's hint replaces the subline (v6 B1). */
const HINT_MS = 1500;

const DIGITS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
] as const;

const inputFor = (target: PadTarget) =>
  document.querySelector<HTMLElement>(
    `[data-set-id="${CSS.escape(target.setId)}"] [data-pad-field="${target.field}"]`,
  );

function locate(workout: Workout, setId: string) {
  for (const exercise of workout.exercises) {
    const index = exercise.sets.findIndex((s) => s.id === setId);
    if (index >= 0) return { exercise, index, set: exercise.sets[index] };
  }
  return null;
}

/** A field's value in what the row shows: the load in the unit, or the reps. */
const shownValue = (set: WorkoutSet, field: PadKeyField, unit: WeightUnit) =>
  field === "weight"
    ? set.weight === null
      ? null
      : toUnit(set.weight, unit)
    : set.reps;

/**
 * The live workout's number pad (mockup v5, B7), at the foot of the screen in
 * thumb reach instead of the phone's keyboard: big digits, a decimal key and
 * backspace, ±2.5 kg (±5 lb) or ±1 rep, Same as last, and Next, which goes
 * kg → reps → (the set's drops) → checks the set → the next set's kg. The
 * field keeps focus (inputmode none), so a hardware keyboard still types and
 * screen readers read it. A tap outside the sets, Escape, the handle or a
 * drag down on it closes the pad. Its sliding is WorkoutDock's.
 */
export default function NumberPad({
  target,
  setTarget,
  workout,
  previous,
  unitFor,
  changeSet,
  targets,
  container,
  dropFrom,
  stepFor = () => 2.5,
  askRir = false,
}: {
  /** Each exercise's weight step in kg (v6 §D5): the ± keys and −20 %. */
  stepFor?: (exerciseId: string) => number;
  /** "Fråga efter RIR" (v6 B12): the pad has an RIR field after reps. */
  askRir?: boolean;
  target: PadTarget;
  setTarget: Dispatch<SetStateAction<PadTarget | null>>;
  workout: Workout;
  /** The last session of each exercise, by exercise id. */
  previous: Map<string, LastSession>;
  /** Each exercise's weight unit (useWeightUnits): the pad types in it. */
  unitFor: (exerciseId: string) => WeightUnit;
  changeSet: (setId: string, change: (set: WorkoutSet) => WorkoutSet) => void;
  /** Each set's target by set id: the pad's Target key fills it in. */
  targets?: ReadonlyMap<string, { text: string; source: FillSource }>;
  /** The dock that slides with the pad: a drag on the handle moves it. */
  container: RefObject<HTMLDivElement>;
  /** Where a drag let go, for the slide out. */
  dropFrom: { current: number };
}) {
  const { t } = useT();
  const mark = formatDecimal(1.5).charAt(1);
  const pad = useRef<HTMLDivElement>(null);
  // The keys under a finger now, by pointer: each shows pressed until lifted.
  const pressed = useRef(new Map<number, HTMLElement>());
  const release = (event: ReactPointerEvent<HTMLElement>) => {
    const button = pressed.current.get(event.pointerId);
    if (!button) return;
    pressed.current.delete(event.pointerId);
    if (![...pressed.current.values()].includes(button))
      button.classList.remove("is-pressed");
  };
  const latest = useRef({ workout, target });
  latest.current = { workout, target };
  const found = locate(workout, target.setId);
  const set = found?.set ?? null;
  const unit = unitFor(found?.exercise.exerciseId ?? "");
  const kgStep = stepFor(found?.exercise.exerciseId ?? "");
  const fields = set ? padFields(set, askRir) : [];
  const field = target.field;
  // RIR takes the slider (RirSlider); the keys type the load and the reps.
  const keyField: PadKeyField = field === "rir" ? "reps" : field;
  const format = padFormat(keyField, unit, mark);
  const text = set
    ? (getSetInputText(set, keyField) ??
      padText(shownValue(set, keyField, unit), mark))
    : "";
  // A key that changed nothing says why, in place of the subline (v6 B1).
  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(hintTimer.current), []);
  const showHint = (message: string | null) => {
    if (!message) return;
    window.clearTimeout(hintTimer.current);
    setHint(message);
    hintTimer.current = window.setTimeout(
      () => setHint(null),
      motionMs(HINT_MS),
    );
  };
  // `fresh` until the first key: the next digit replaces what is shown.
  const key = `${target.setId}:${field}`;
  const [entry, setEntry] = useState({ key, text, fresh: true });
  if (entry.key !== key || entry.text !== text)
    setEntry({ key, text, fresh: true });
  // Keys press on pointerdown: two taps can land before React draws the
  // first, so each key reads and writes the latest entry here.
  const entryRef = useRef(entry);
  entryRef.current = entry;

  // The set it types was checked some other way than the pad's own Bocka or
  // the row's ✓ (which move it first): it moves on to the next open set of the
  // exercise, or closes at the end of it. A deleted or no longer typed field
  // closes it.
  // A checked set's RIR can still change: it is picked after the set (B12).
  const gone = !set || (set.done && field !== "rir") || !fields.includes(field);
  useEffect(() => {
    if (!gone) return;
    setTarget((current) => {
      if (current !== target) return current;
      const w = latest.current.workout;
      const here = locate(w, target.setId);
      return here?.set.done ? padAfterCheck(w.exercises, target.setId) : null;
    });
  }, [gone, target, setTarget]);

  /** Typed text that is not a finished number ("87,") is cleaned up on leaving. */
  const commit = (at: PadTarget | null) => {
    if (!at) return;
    if (at.field === "rir") return;
    const atField = at.field;
    const here = locate(latest.current.workout, at.setId)?.set;
    if (!here || getSetInputText(here, atField) === undefined) return;
    changeSet(at.setId, (s) => changeSetNumber(s, atField, s[atField]));
  };
  const close = () => {
    commit(latest.current.target);
    setTarget(null);
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.matches("[data-pad-field]"))
      active.blur();
  };
  const closeRef = useRef(close);
  closeRef.current = close;
  // The pad's own click on a row's ✓ passes the handlers below untouched.
  const selfClick = useRef(false);
  const clickCheck = (setId: string) => {
    selfClick.current = true;
    try {
      document
        .querySelector<HTMLButtonElement>(
          `[data-set-id="${CSS.escape(setId)}"] .set-check`,
        )
        ?.click();
    } finally {
      selfClick.current = false;
    }
  };
  /**
   * Checks the set the pad types, from the pad's Check or the row's own ✓:
   * what is typed is finished first ("87," becomes 87), then, once React has
   * drawn it, the row's ✓ checks the set (its hint, rest, haptics and motion)
   * and the pad moves to the next open set of the exercise, or closes at the
   * end of it. A set the row refuses (a value missing) keeps the pad.
   */
  const checkHead = (headId: string) => {
    commit(latest.current.target);
    window.setTimeout(() => {
      const w = latest.current.workout;
      const head = locate(w, headId);
      if (!head) return;
      if (!groupComplete(head.exercise.sets, head.index)) {
        clickCheck(headId);
        return;
      }
      const after = padAfterCheck(w.exercises, headId);
      setTarget(after);
      clickCheck(headId);
      // The end of the exercise: the pad closes and the field lets go.
      if (!after) {
        const active = document.activeElement;
        if (active instanceof HTMLElement && active.matches("[data-pad-field]"))
          active.blur();
      }
    }, 0);
  };
  /**
   * A tap on a row's ✓ while the pad is open. The ✓ of the set the pad types
   * (or of its drops' set) is taken over by `checkHead`; true then. Any other
   * ✓ is left to the row, and the pad stays where it is.
   */
  const onRowCheck = (button: HTMLElement) => {
    const setId = button.closest("[data-set-id]")?.getAttribute("data-set-id");
    const { workout: w, target: at } = latest.current;
    const head = setId ? locate(w, setId) : null;
    if (!head || head.set.done || !at) return false;
    const { start, end } = dropGroup(head.exercise.sets, head.index);
    const group = head.exercise.sets.slice(start, end);
    if (!group.some((s) => s.id === at.setId)) return false;
    // A tap: the rest's tone may play after the check (iPhone Safari).
    primeRestSound();
    checkHead(head.set.id);
    return true;
  };
  const checkRef = useRef(onRowCheck);
  checkRef.current = onRowCheck;
  const moveTo = (next: PadTarget | null) => {
    commit(latest.current.target);
    setTarget(next);
  };
  // The pad also leaves a field when another one is tapped (the row opens it
  // there): what was typed in the field it left is finished then too.
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const typed = useRef(target);
  useEffect(() => {
    const before = typed.current;
    typed.current = target;
    if (before.setId !== target.setId || before.field !== target.field)
      commitRef.current(before);
  }, [target]);

  // The field it types gets a ring. With a mouse and keyboard it also keeps
  // focus, so typing still works; on a touch screen no field holds focus
  // (inputmode none), since every move of focus makes iPhone hide and show
  // its keyboard state and shift the view, and the pad would seem to blink.
  useEffect(() => {
    const input = inputFor(target);
    if (!input) return;
    input.setAttribute("data-pad-target", "");
    const active = document.activeElement;
    if (input.getAttribute("inputmode") === "none") {
      // Whatever field had focus lets go, also one the phone's own keyboard
      // types (a hold, a timed set, cardio): that keyboard closes for the pad.
      if (
        active instanceof HTMLElement &&
        active.matches("input, textarea, select")
      )
        active.blur();
    } else if (active !== input && !pad.current?.contains(active))
      input.focus({ preventScroll: true });
    return () => input.removeAttribute("data-pad-target");
  }, [target]);

  // Only a tap outside the pad and the set fields closes it (or Escape, or a
  // drag on its handle): moving focus by itself never does.
  const keysRef = useRef<((key: PadKey | "next") => void) | null>(null);
  const drag = useRef<{ y0: number; t0: number; dy: number } | null>(null);
  // A drag on the handle ends with a click on it: that click is the drag's.
  const dragged = useRef(false);
  useEffect(() => {
    const inside = (node: EventTarget | null) =>
      node instanceof Element &&
      (!!container.current?.contains(node) ||
        !!node.closest("[data-pad-field], [data-pad-keep]"));
    const onClick = (event: MouseEvent) => {
      if (selfClick.current) return;
      const node = event.target;
      // A row's own ✓ keeps the pad: checking the set it types moves it on.
      const check =
        node instanceof Element
          ? node.closest<HTMLElement>(".set-check")
          : null;
      if (check) {
        // The pad checks that set itself, after finishing what was typed.
        if (checkRef.current(check)) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (!inside(node)) closeRef.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") return closeRef.current();
      // A keyboard attached to a touch screen: no field holds focus there, so
      // its keys type on the pad. A focused field takes its own typing.
      const active = document.activeElement;
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (active instanceof HTMLElement &&
          (active.isContentEditable ||
            active.matches("input, textarea, select")))
      )
        return;
      const padKey = padKeyFor(event.key);
      if (!padKey) return;
      // Enter on a focused button (the pad's own keys) presses that button.
      if (padKey === "next" && active instanceof HTMLButtonElement) return;
      event.preventDefault();
      keysRef.current?.(padKey);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [container]);

  if (!found || !set) return null;
  const { exercise, index } = found;
  const prior = previousResult(
    previous.get(exercise.exerciseId)?.sets ?? [],
    exercise.sets,
    index,
  );
  const next = padNext(workout.exercises, target, askRir);
  const willCheck = next.kind === "check";
  const drop = isDrop(set);

  const write = (nextText: string) => {
    const value = padValue(nextText);
    const stored =
      keyField === "weight" && value !== null ? fromUnit(value, unit) : value;
    const unfinished = nextText !== padText(value, mark) ? nextText : undefined;
    changeSet(set.id, (s) => changeSetNumber(s, keyField, stored, unfinished));
  };
  const press = (k: PadKey) => {
    const before = entryRef.current;
    const after = pressPadKey(before, k, format);
    if (after.text === before.text && after.fresh === before.fresh) {
      showHint(padHint(k, keyField, before.fresh ? "" : before.text, format));
      return;
    }
    // A fresh field's backspace clears what it showed; once empty, say so.
    if (k === "backspace" && !before.text)
      showHint(padHint(k, keyField, "", format));
    const next = { key, ...after };
    entryRef.current = next;
    setEntry(next);
    if (after.text !== before.text) write(after.text);
  };
  const step = (direction: 1 | -1) => {
    const value = stepPadValue(
      padValue(entryRef.current.text),
      direction,
      keyField,
      unit,
      kgStep,
    );
    const nextText = padText(value, mark);
    const next = { key, text: nextText, fresh: true };
    entryRef.current = next;
    setEntry(next);
    write(nextText);
    playStep(inputFor(target), direction);
  };
  /**
   * A digit, decimal, backspace or ± key: it presses as the finger lands
   * (padKeyPresses), each finger once, and shows it is pressed until the
   * finger lifts. Its pointerdown is cancelled, so the browser does no focus,
   * zoom or text selection; WebKit then drops that touch's click, which the
   * key no longer needs. Enter and Space on a focused key still press it.
   */
  const keyPress = (action: () => void) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      const button = event.currentTarget;
      if (button.disabled || !padKeyPresses(event)) return;
      event.preventDefault();
      pressed.current.set(event.pointerId, button);
      button.classList.add("is-pressed");
      action();
    },
    onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (padKeyPresses(event)) action();
    },
    onPointerUp: release,
    onPointerCancel: release,
    onPointerLeave: release,
  });
  // Same as last, or the target: both fields at once, the pad stays.
  const fill = (source: FillSource | undefined) => {
    if (!source) return;
    changeSet(set.id, (s) => fillFrom(s, source));
    setEntry((e) => ({ ...e, fresh: true }));
    for (const f of fields) playStep(inputFor({ setId: set.id, field: f }), 1);
  };
  const same = () => fill(prior);
  // On a drop "Som förra passet" is "−20 %": 20 % under the row above,
  // rounded to the exercise's step (v6 B1, B5).
  const above = drop ? exercise.sets[index - 1] : undefined;
  const minus20 = () => {
    if (above?.weight == null) return;
    const kg = dropMinus20(above.weight, kgStep);
    changeSet(set.id, (s) => changeSetNumber(s, "weight", kg));
    setEntry((e) => ({ ...e, fresh: true }));
    playStep(inputFor({ setId: set.id, field: "weight" }), -1);
  };
  const goal = targets?.get(set.id);
  const range = exercise.repRange;
  // "Mål 100 × 6 (5–7)": the target chip, with the rep range.
  const goalText =
    goal && range
      ? `${goal.text} (${range.min === range.max ? range.min : `${range.min}–${range.max}`})`
      : goal?.text;
  const onNext = () => {
    // A tap: the rest's tone may play after the check below (iPhone Safari).
    primeRestSound();
    if (next.kind === "field") return moveTo(next.target);
    if (next.kind === "close") return close();
    checkHead(next.setId);
  };

  // v6 B12: "Klar ✓" checks the set with the RIR chosen; "Hoppa över"
  // checks it without one. A checked set's RIR (picked after) just closes.
  const doneRir = () => {
    primeRestSound();
    if (set.done) return close();
    if (next.kind === "check") checkHead(next.setId);
    else close();
  };
  const skipRir = () => {
    if (set.done) return close();
    changeSet(set.id, (s) => withRir(s, null));
    doneRir();
  };

  keysRef.current = (k) => {
    if (field === "rir") {
      // A keyboard's 0–5 picks the RIR, Enter is Klar.
      if (k === "next") return doneRir();
      if (/^[0-5]$/.test(k)) changeSet(set.id, (s) => withRir(s, Number(k)));
      return;
    }
    return k === "next" ? onNext() : press(k);
  };

  // A drag on the handle moves the pad (and the dock above it) down: let go
  // past 90 px, or faster than 0.6 px/ms, and it closes; else it springs back.
  const grabDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    drag.current = { y0: event.clientY, t0: event.timeStamp, dy: 0 };
    dragged.current = false;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Without capture the drag still follows inside the handle.
    }
  };
  const grabMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    d.dy = Math.max(0, event.clientY - d.y0);
    if (container.current)
      container.current.style.transform = d.dy ? `translateY(${d.dy}px)` : "";
  };
  const grabUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.dy < 6) return;
    dragged.current = true;
    const velocity = d.dy / Math.max(1, event.timeStamp - d.t0);
    if (container.current) container.current.style.transform = "";
    if (event.type === "pointerup" && (d.dy > 90 || velocity > 0.6)) {
      dropFrom.current = d.dy;
      close();
      return;
    }
    playSpring(container.current, SPRING.settle, d.dy, 0, (y) => ({
      transform: `translateY(${y}px)`,
    }));
  };

  // The exercise gets the whole title line; the set's short name leads the
  // line below so neither is cut beside the field toggle.
  const setName = setBadge(exercise.sets, index).short;
  const stepLabel = (direction: 1 | -1) =>
    padStepLabel(keyField, unit, direction, mark, kgStep);
  const stepName = (direction: 1 | -1) =>
    keyField === "reps"
      ? t("pad.stepReps", { step: stepLabel(direction) })
      : `${stepLabel(direction)} ${unit}`;
  // "Set 2 · Förra 100 kg × 5"; a drop says how its weight was filled in
  // (v6 B5): "Drop efter set 3 · 50 kg förifyllt (−20 % …)".
  const subline = (() => {
    if (!drop) {
      return prior
        ? `${setName} · ${t("pad.previous", { value: labelSet(prior, true, unit) })}`
        : setName;
    }
    const { start } = dropGroup(exercise.sets, index);
    const parent = setBadge(exercise.sets, start).text;
    const position = index - start;
    const filled =
      above?.weight != null &&
      set.weight !== null &&
      unit === "kg" &&
      set.weight === dropMinus20(above.weight, kgStep);
    if (!filled) return t("pad.dropPlain", { set: parent });
    const kg = formatDecimal(set.weight!);
    const stepText = formatDecimal(kgStep);
    return position <= 1
      ? t("pad.dropFirst", { set: parent, kg, step: stepText })
      : t("pad.dropNext", {
          n: position,
          set: parent,
          kg,
          from: formatDecimal(above!.weight!),
          step: stepText,
        });
  })();

  return (
    <div
      ref={pad}
      className="number-pad"
      role="group"
      aria-label={t("pad.title")}
      // Taps on the pad leave focus in the field it types. The digit, mark,
      // backspace and ± keys cancel their own pointerdown (keyPress); the
      // pad does not, since WebKit would then drop the click that Next,
      // Check, Same as last and Target act on.
      onMouseDown={(event) => event.preventDefault()}
    >
      <button
        type="button"
        className="number-pad-grab"
        aria-label={t("pad.close")}
        onClick={(event) => {
          // A tap (or the keyboard) closes; a drag already closed the pad
          // or let it spring back.
          const wasDrag = dragged.current;
          dragged.current = false;
          if (event.detail === 0 || !wasDrag) close();
        }}
        onPointerDown={grabDown}
        onPointerMove={grabMove}
        onPointerUp={grabUp}
        onPointerCancel={grabUp}
      >
        <span aria-hidden="true" />
      </button>
      <div
        className="number-pad-head"
        data-fields={askRir && fields.includes("rir") ? 3 : 2}
      >
        <div className="number-pad-titles">
          <p className="number-pad-title">
            {exerciseDisplayName(exercise.exerciseId, exercise.name)}
          </p>
          <p
            className={`number-pad-meta${hint ? " is-hint" : ""}`}
            aria-live="polite"
          >
            {hint ?? subline}
          </p>
          {/* The Target key: fills the set's target in one tap. */}
          {goal && goalText && (
            <button
              type="button"
              className="number-pad-target"
              aria-label={t("pad.fillTarget", { value: goal.text })}
              onClick={() => fill(goal.source)}
            >
              {goalText}
            </button>
          )}
        </div>
        <Segmented<PadField>
          label={t("pad.field")}
          value={field}
          options={[
            {
              value: "weight",
              label: unit,
              disabled: !fields.includes("weight"),
            },
            {
              value: "reps",
              label: t("pad.reps"),
              disabled: !fields.includes("reps"),
            },
            ...(askRir && fields.includes("rir")
              ? [{ value: "rir" as const, label: t("pad.rir") }]
              : []),
          ]}
          onChange={(value) => moveTo({ setId: set.id, field: value })}
        />
      </div>
      {field === "rir" ? (
        // v6 B12: the slider in the keys' place, in the same fixed height.
        <div className="number-pad-rir">
          <RirSlider
            value={rirOf(set)}
            onChange={(value) => changeSet(set.id, (s) => withRir(s, value))}
          />
          <div className="number-pad-rir-keys">
            <button
              type="button"
              className="number-pad-key is-step"
              onClick={skipRir}
            >
              {t("pad.rirSkip")}
            </button>
            <button
              type="button"
              className="number-pad-key is-go is-check"
              onClick={doneRir}
            >
              {t("pad.check")}
              <Check size={20} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <div className="number-pad-grid">
          {DIGITS.map((row, r) => (
            <Fragment key={r}>
              {row.map((digit) => (
                <button
                  key={digit}
                  type="button"
                  className="number-pad-key"
                  {...keyPress(() => press(digit))}
                >
                  {digit}
                </button>
              ))}
              {r === 0 && (
                <button
                  type="button"
                  className="number-pad-key is-step"
                  aria-label={stepName(-1)}
                  {...keyPress(() => step(-1))}
                >
                  {stepLabel(-1)}
                </button>
              )}
              {r === 1 && (
                <button
                  type="button"
                  className="number-pad-key is-step"
                  aria-label={stepName(1)}
                  {...keyPress(() => step(1))}
                >
                  {stepLabel(1)}
                </button>
              )}
              {r === 2 &&
                (drop ? (
                  <button
                    type="button"
                    className="number-pad-key is-step is-same"
                    aria-label={t("pad.dropMinusLabel")}
                    disabled={above?.weight == null}
                    onClick={minus20}
                  >
                    {t("pad.dropMinus")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="number-pad-key is-step is-same"
                    disabled={!prior}
                    onClick={same}
                  >
                    {t("pad.same")}
                  </button>
                ))}
            </Fragment>
          ))}
          <button
            type="button"
            // Reps take no decimal: the key stays, muted, and says why.
            className={`number-pad-key${format.decimals === 0 ? " is-muted" : ""}`}
            aria-label={t("pad.decimal")}
            aria-disabled={format.decimals === 0 || undefined}
            {...keyPress(() => press("decimal"))}
          >
            {mark}
          </button>
          <button
            type="button"
            className="number-pad-key"
            {...keyPress(() => press("0"))}
          >
            0
          </button>
          <button
            type="button"
            className="number-pad-key"
            aria-label={t("pad.backspace")}
            {...keyPress(() => press("backspace"))}
          >
            <Delete size={24} strokeWidth={1.75} aria-hidden="true" />
          </button>
          {/* Next and Check act on the click, not as the finger lands: they
            move the pad or check the set, so a thumb resting on them must
            not fire, and the click is the tap that lets iPhone Safari play
            the rest's tone later. */}
          <button
            type="button"
            className={`number-pad-key is-go${willCheck ? " is-check" : ""}`}
            onClick={onNext}
          >
            {willCheck ? (
              <>
                {t("pad.check")}
                <Check size={20} strokeWidth={2.5} aria-hidden="true" />
              </>
            ) : (
              <>
                {t("pad.next")}
                <ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
