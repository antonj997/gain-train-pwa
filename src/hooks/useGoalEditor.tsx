import { useRef, useState } from "react";
import GoalEditor from "@/components/goals/GoalEditor";
import type { GoalItem } from "@/data/goals";

/**
 * The goal editor sheet and a function that opens it, for a goal or "new".
 * Each opening starts a fresh form; the last goal stays rendered while the
 * sheet animates closed.
 */
export function useGoalEditor() {
  const [editing, setEditing] = useState<GoalItem | "new" | null>(null);
  const [session, setSession] = useState(0);
  const shown = useRef(editing);
  if (editing) shown.current = editing;
  const edit = (next: GoalItem | "new") => {
    setSession((n) => n + 1);
    setEditing(next);
  };
  const current = shown.current;
  const editor = current && (
    <GoalEditor
      key={session}
      open={editing !== null}
      goal={current === "new" ? null : current}
      onClose={() => setEditing(null)}
    />
  );
  return { edit, editor };
}
