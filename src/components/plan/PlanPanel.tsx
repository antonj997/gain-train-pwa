import { useMemo, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import GroupEditor from "@/components/plan/GroupEditor";
import ListRow from "@/components/ui/ListRow";
import { libraryOf } from "@/data/exercises";
import type { RoutineGroup } from "@/data/model";
import { groupsOf } from "@/data/plans";
import { routines as routineRecords } from "@/data/selectors";
import { countLabel } from "@/lib/labels";
import { t } from "@/i18n";
import { categoryLabel } from "@/lib/catalogue-labels";

/**
 * Library → Scheman's Advanced part: groups, for one plan day offering a
 * choice of routines. Deload weeks and progression live in the plan itself,
 * so groups sit here, folded away. The plans list is PlansTab.
 */
export default function PlanPanel() {
  const { state, saveLibrary } = useData();
  const { account } = useAuth();
  const groups = useMemo(() => groupsOf(state.records), [state.records]);
  const routines = useMemo(
    () => routineRecords(state.records),
    [state.records],
  );
  // An existing group, or null for a new one; undefined while closed.
  const [editing, setEditing] = useState<RoutineGroup | null | undefined>();
  // A new key each time, so a reopened editor starts from the saved record.
  const [session, setSession] = useState(0);
  const edit = (group: RoutineGroup | null) => {
    setSession((n) => n + 1);
    setEditing(group);
  };
  // The editor keeps its content while the sheet slides out.
  const shown = useRef<RoutineGroup | null | undefined>(editing);
  if (editing !== undefined) shown.current = editing;

  const saveGroups = (next: RoutineGroup[]) =>
    saveLibrary({ ...libraryOf(state.records, account), groups: next });

  return (
    <>
      <details className="plan-advanced">
        <summary>
          <span className="row-main">
            <span className="row-title">{t("plan.advanced")}</span>
            <span className="row-sub">
              {groups.length
                ? `${t("plan.groups")} · ${groups.length}`
                : t("plan.groups")}
            </span>
          </span>
          <ChevronDown className="chev" size={20} aria-hidden="true" />
        </summary>
        <section aria-labelledby="groups-heading">
          {/* The summary above already reads Groups. */}
          <h2 className="sr-only" id="groups-heading">
            {t("plan.groups")}
          </h2>
          <p className="row-sub">{t("plan.groupsExplain")}</p>
          {groups.length > 0 && (
            <div className="list">
              {groups.map((g) => (
                <ListRow
                  key={g.id}
                  title={g.name}
                  sub={[
                    countLabel(g.routineIds.length, "routine"),
                    g.categories.map(categoryLabel).join(", "),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  chevron
                  onClick={() => edit(g)}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            className="btn-dashed"
            onClick={() => edit(null)}
          >
            <Plus size={20} aria-hidden="true" />
            {t("plan.newGroup")}
          </button>
        </section>
      </details>
      {session > 0 && (
        <GroupEditor
          key={session}
          open={editing !== undefined}
          group={shown.current ?? null}
          routines={routines}
          onSave={(group) =>
            saveGroups(
              groups.some((g) => g.id === group.id)
                ? groups.map((g) => (g.id === group.id ? group : g))
                : [...groups, group],
            )
          }
          onDelete={(id) => saveGroups(groups.filter((g) => g.id !== id))}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}
