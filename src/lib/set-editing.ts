import type { WorkoutSet } from "../data/model";

export type SetReorder = { id: string; targetIndex: number };
export type SetReorderEvent =
  | { type: "pointer-start"; id: string; pointerId: number }
  | { type: "pointer-move"; pointerId: number; targetIndex: number }
  | { type: "pointer-end" | "pointer-cancel"; pointerId: number }
  | { type: "key"; id: string; key: string }
  | { type: "cancel" };
export type SetReorderResult<T> = {
  order: SetReorder | null;
  handled: boolean;
  commit: T[] | null;
  finished: (SetReorder & { cancelled: boolean }) | null;
};

export function createSetReorderController() {
  let order: SetReorder | null = null;
  let pointerId: number | undefined;
  return {
    current: () => order,
    send<T extends { id: string }>(
      sets: T[],
      event: SetReorderEvent,
    ): SetReorderResult<T> {
      const result: SetReorderResult<T> = {
        order,
        handled: false,
        commit: null,
        finished: null,
      };
      const start = (id: string, pointer?: number) => {
        if (order) return;
        order = beginSetReorder(sets, id);
        if (!order) return;
        pointerId = pointer;
        result.handled = true;
      };
      const finish = (cancelled: boolean) => {
        if (!order) return;
        const next = finishSetReorder(sets, order, cancelled);
        result.commit = next === sets ? null : next;
        result.finished = { ...order, cancelled };
        result.handled = true;
        order = null;
        pointerId = undefined;
      };
      const target = (index: number) => {
        if (!order) return;
        order = setReorderTarget(order, index, sets.length);
        result.handled = true;
      };
      if (event.type === "pointer-start") start(event.id, event.pointerId);
      else if (event.type === "pointer-move" && pointerId === event.pointerId)
        target(event.targetIndex);
      else if (
        (event.type === "pointer-end" || event.type === "pointer-cancel") &&
        pointerId === event.pointerId
      )
        finish(event.type === "pointer-cancel");
      else if (event.type === "cancel") finish(true);
      else if (event.type === "key") {
        if (event.key === "Escape") finish(true);
        else if (event.key === " " || event.key === "Enter") {
          if (order && pointerId === undefined) finish(false);
          else if (!order) start(event.id);
        } else if (order?.id === event.id && pointerId === undefined) {
          const step =
            event.key === "ArrowUp" || event.key === "ArrowLeft"
              ? -1
              : event.key === "ArrowDown" || event.key === "ArrowRight"
                ? 1
                : 0;
          if (step) target(order.targetIndex + step);
        }
      }
      result.order = order;
      return result;
    },
  };
}

export function pointerSetTarget(
  clientY: number,
  offsetY: number,
  initialScrollTop: number,
  scrollTop: number,
  centers: number[],
) {
  const y = clientY - offsetY + scrollTop - initialScrollTop;
  return centers.filter((center) => y > center).length;
}

export function edgeScrollDelta(
  clientY: number,
  top: number,
  bottom: number,
  scrollTop: number,
  maxScrollTop: number,
  elapsedMs: number,
) {
  if (bottom <= top) return 0;
  const edge = Math.min(48, (bottom - top) / 2);
  const strength =
    clientY < top + edge
      ? -Math.min(1, (top + edge - clientY) / edge)
      : clientY > bottom - edge
        ? Math.min(1, (clientY - bottom + edge) / edge)
        : 0;
  const delta = Math.ceil(
    Math.min(24, Math.max(0, elapsedMs) * 0.5) * Math.abs(strength),
  );
  const bounded =
    strength < 0
      ? -Math.min(delta, Math.max(0, scrollTop))
      : Math.min(delta, Math.max(0, maxScrollTop - scrollTop));
  return bounded || 0;
}

export function beginSetReorder<T extends { id: string }>(
  sets: T[],
  id: string,
): SetReorder | null {
  const targetIndex = sets.findIndex((set) => set.id === id);
  return targetIndex < 0 ? null : { id, targetIndex };
}

export function setReorderTarget(
  reorder: SetReorder,
  targetIndex: number,
  count: number,
): SetReorder {
  if (!Number.isFinite(targetIndex) || count < 1) return reorder;
  const boundedIndex = Math.max(
    0,
    Math.min(count - 1, Math.trunc(targetIndex)),
  );
  return boundedIndex === reorder.targetIndex
    ? reorder
    : { ...reorder, targetIndex: boundedIndex };
}

export function finishSetReorder<T extends { id: string }>(
  sets: T[],
  reorder: SetReorder | null,
  cancelled = false,
): T[] {
  if (!reorder || cancelled) return sets;
  const from = sets.findIndex((set) => set.id === reorder.id);
  if (from < 0) return sets;
  const target = setReorderTarget(
    reorder,
    reorder.targetIndex,
    sets.length,
  ).targetIndex;
  if (from === target) return sets;
  const result = [...sets];
  result.splice(from, 1);
  result.splice(target, 0, sets[from]);
  return result;
}

/** Number inputs support select(), but not setSelectionRange(). */
export function selectInputValue(event: { currentTarget: HTMLInputElement }) {
  event.currentTarget.select();
}

export function bodyWeightForSet(
  set: WorkoutSet,
  profileWeight: number | null,
) {
  return set.done ? (set.bodyWeightKg ?? null) : profileWeight;
}

export function toggleSetCompletion(
  set: WorkoutSet,
  profileWeight: number | null,
): WorkoutSet {
  const result = { ...set, done: !set.done };
  delete result.bodyWeightKg;
  if (result.done && set.load === "bodyweight" && profileWeight !== null)
    result.bodyWeightKg = profileWeight;
  return result;
}
