import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Star,
} from "lucide-react";
import { useData } from "@/contexts/useData";
import { favouriteChange } from "@/data/exercises";
import {
  completedWorkouts,
  customCategories,
  customDefaults,
  runningWorkouts,
} from "@/data/selectors";
import { newWorkout } from "@/data/start";
import { lastSessions } from "@/data/workouts";
import { useHiddenExercises } from "@/hooks/useHiddenExercises";
import { useStartWorkout } from "@/hooks/useStartWorkout";
import { addExercises } from "@/lib/workout-editor";
import { notify } from "@/lib/message-store";
import { exercisePath, workoutPath } from "@/lib/routes";
import { autoWorkoutName } from "@/lib/workout-name";
import ContextMenu, { type MenuItem } from "./ContextMenu";
import { t } from "@/i18n";

/** What a row's menu needs to know about its exercise. */
export type MenuExercise = {
  id: string;
  name: string;
  category: string;
  custom: boolean;
  favourite: boolean;
  hidden?: boolean;
};

const ICON = 18;

/**
 * A flat exercise row's long-press menu (Library, the picker, Progress): add
 * to the workout, favourite, hide, edit (your own) and the exercise page. The
 * same actions are on the row's ⋯ or the exercise page. `open` it with the
 * row; render `menu`.
 */
export function useExerciseMenu({
  add,
  onEdit,
}: {
  /**
   * The first item: in the picker, add to (or take out of) the selection.
   * Left out, it adds to the running workout, or starts one with it.
   */
  add?: (e: MenuExercise) => MenuItem | null;
  /** Edit in place (Library); otherwise Library's editor opens. */
  onEdit?: (e: MenuExercise) => void;
} = {}) {
  const { state, save } = useData();
  const { hidden, setHidden } = useHiddenExercises();
  const navigate = useNavigate();
  const workoutStart = useStartWorkout();
  const [open, setOpen] = useState<{
    exercise: MenuExercise;
    anchor: HTMLElement;
  } | null>(null);

  const addToWorkout = (e: MenuExercise) => {
    const target = { id: e.id, name: e.name, ...customDefaults(state.records).get(e.id) };
    const [running] = runningWorkouts(state.records);
    // The workout adds it with your last sets, as its own picker would.
    if (running)
      navigate(workoutPath(running.id), { state: { add: [target] } });
    else {
      const records = Object.values(state.records);
      const base = newWorkout(records);
      const withExercise = addExercises(
        base,
        [target],
        lastSessions(completedWorkouts(state.records)),
      );
      void workoutStart.start({
        ...withExercise,
        name: autoWorkoutName(
          { name: "", exercises: withExercise.exercises },
          {},
          customCategories(state.records),
        ),
      });
    }
  };

  const items = (e: MenuExercise): MenuItem[] => {
    const isHidden = e.hidden ?? hidden.has(e.id);
    const first = add
      ? add(e)
      : {
          key: "add",
          label: t("menu.addToWorkout"),
          icon: <Plus size={ICON} aria-hidden="true" />,
          onSelect: () => addToWorkout(e),
        };
    const list: (MenuItem | null)[] = [
      first,
      {
        key: "favourite",
        label: e.favourite
          ? t("exercises.unfavourite")
          : t("exercises.favourite"),
        icon: (
          <Star
            size={ICON}
            fill={e.favourite ? "currentColor" : "none"}
            aria-hidden="true"
          />
        ),
        onSelect: async () => {
          try {
            const change = favouriteChange(state.records, e);
            await save(change.id, "exercise", change.payload, change.deleted);
          } catch {
            notify.error(t("exercises.favouriteFailed"));
          }
        },
      },
      {
        key: "hide",
        label: isHidden
          ? t("exercises.unhideExercise")
          : t("exercises.hideExercise"),
        icon: isHidden ? (
          <Eye size={ICON} aria-hidden="true" />
        ) : (
          <EyeOff size={ICON} aria-hidden="true" />
        ),
        tone: isHidden ? undefined : "danger",
        onSelect: async () => {
          try {
            await setHidden(e.id, !isHidden);
            notify(
              t(isHidden ? "exercises.back" : "exercises.hidden", {
                name: e.name,
              }),
            );
          } catch {
            notify.error(
              t(isHidden ? "exercises.unhideFailed" : "exercises.hideFailed", {
                name: e.name,
              }),
            );
          }
        },
      },
      e.custom
        ? {
            key: "edit",
            label: t("exercises.edit"),
            icon: <Pencil size={ICON} aria-hidden="true" />,
            onSelect: () =>
              onEdit
                ? onEdit(e)
                : navigate(`/library?tab=exercises&edit=${e.id}`),
          }
        : null,
      {
        key: "open",
        label: t("menu.openExercise"),
        icon: <ArrowUpRight size={ICON} aria-hidden="true" />,
        onSelect: () => navigate(exercisePath(e.id)),
      },
    ];
    return list.filter((item): item is MenuItem => !!item);
  };

  const menu = (
    <>
      {workoutStart.confirmation}
      <ContextMenu
        anchor={open?.anchor ?? null}
        title={open?.exercise.name ?? ""}
        label={t("menu.optionsFor", { name: open?.exercise.name ?? "" })}
        items={open ? items(open.exercise) : []}
        onClose={() => setOpen(null)}
      />
    </>
  );
  return {
    open: (exercise: MenuExercise, anchor: HTMLElement) =>
      setOpen({ exercise, anchor }),
    menu,
  };
}

/** The picker's first item: put the exercise in or out of the selection. */
export const selectionItem = (
  selected: boolean,
  toggle: () => void,
): MenuItem => ({
  key: "select",
  label: selected ? t("menu.removeFromSelection") : t("menu.addToSelection"),
  icon: selected ? (
    <Check size={ICON} aria-hidden="true" />
  ) : (
    <Plus size={ICON} aria-hidden="true" />
  ),
  onSelect: toggle,
});
