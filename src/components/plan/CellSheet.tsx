import { Check } from "lucide-react";
import ListRow from "@/components/ui/ListRow";
import Sheet from "@/components/ui/Sheet";
import type { RoutineGroup } from "@/data/model";
import { REST, dayTypes, groupCell, resolveCell, typeCell } from "@/data/plans";

type Routines = readonly { id: string; payload: { name: string } }[];

/**
 * Chooses what a plan day holds: rest, a day type, a group, a routine or
 * nothing. A date can also fall back to the template (`useTemplate`).
 */
export default function CellSheet({
  open,
  title,
  current,
  routines,
  groups,
  emptyLabel,
  useTemplate,
  onChoose,
  onClose,
}: {
  open: boolean;
  title: string;
  /** The day's present cell; undefined when a date follows the template. */
  current: string | null | undefined;
  routines: Routines;
  groups: readonly RoutineGroup[];
  emptyLabel: string;
  /** Offers "Use the template", with what the template holds for that day. */
  useTemplate?: string;
  onChoose: (cell: string | null | undefined) => void;
  onClose: () => void;
}) {
  const option = (
    cell: string | null | undefined,
    label: string,
    sub?: string,
  ) => (
    <ListRow
      key={String(cell) + label}
      title={label}
      sub={sub}
      onClick={() => onChoose(cell)}
      trailing={
        current === cell ? (
          <Check size={20} className="plan-check" aria-label="Selected" />
        ) : undefined
      }
    />
  );
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="list">
        {useTemplate !== undefined &&
          option(undefined, "Use the template", useTemplate || "Nothing")}
        {option(null, emptyLabel)}
        {option(REST, "Rest")}
      </div>
      <section aria-label="Day types">
        <h3 className="group-title">Day types</h3>
        <div className="list">
          {dayTypes.map((t) =>
            option(typeCell(t.id), t.label, t.categories.join(", ")),
          )}
        </div>
      </section>
      {groups.length > 0 && (
        <section aria-label="Groups">
          <h3 className="group-title">Groups</h3>
          <div className="list">
            {groups.map((g) => option(groupCell(g.id), g.name))}
          </div>
        </section>
      )}
      {routines.length > 0 && (
        <section aria-label="Routines">
          <h3 className="group-title">Routines</h3>
          <div className="list">
            {routines.map((r) => option(r.id, r.payload.name))}
          </div>
        </section>
      )}
    </Sheet>
  );
}
