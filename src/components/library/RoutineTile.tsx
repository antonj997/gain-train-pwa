import { Fragment, forwardRef } from "react";
import { Check, Globe, MoreHorizontal, Play, Plus } from "lucide-react";
import RoutineGlyph from "@/components/library/RoutineGlyph";
import { useLongPress } from "@/hooks/useLongPress";
import { namePieces, type TileIcon } from "@/lib/routine-library";
import { t } from "@/i18n";

export type TileAction = {
  /** Play starts your routine; + saves someone else's; ✓ is saved. */
  kind: "start" | "save" | "saved";
  label: string;
  onClick?: () => void;
  disabled?: boolean;
};

type Props = {
  name: string;
  icons: readonly TileIcon[];
  /** Categories beyond the icons: a "+N" chip. */
  more: number;
  /** "6 övningar · ~55 min". */
  meta: string;
  /** "Kört mån 16 nov", "Aldrig körd" or "av Erik". */
  foot: string;
  /** Shown in Discover: a small globe after the name. */
  shared?: boolean;
  openLabel: string;
  onOpen: () => void;
  /** The ⋯ menu; press and hold opens it too. */
  menuLabel?: string;
  onMenu?: () => void;
  action: TileAction;
  /** A short accent ring: the copy Duplicate just made. */
  highlight?: boolean;
  /** Preview only (the Dela sheet): drawn as others see it, nothing reacts. */
  inert?: boolean;
  /** The grid's key for this tile (useGridMotion). */
  itemKey?: string;
};

/**
 * A routine as an equal tile, two to a row: up to three category icons, the
 * name on two lines at most (breaking after | and /), its exercises and
 * length, and when it was last done (or who shared it). ⋯ at the top right,
 * a round play (or +) at the bottom right; a tap elsewhere opens the
 * preview. Every tile has these four lines in the same places, so a grid row
 * lines up.
 */
const RoutineTile = forwardRef<HTMLDivElement, Props>(function RoutineTile(
  {
    name,
    icons,
    more,
    meta,
    foot,
    shared,
    openLabel,
    onOpen,
    menuLabel,
    onMenu,
    action,
    highlight,
    inert,
    itemKey,
  },
  ref,
) {
  const longPress = useLongPress(inert ? undefined : onMenu);
  const ActionIcon =
    action.kind === "start" ? Play : action.kind === "save" ? Plus : Check;
  return (
    <div
      ref={ref}
      data-key={itemKey}
      className={
        "routine-tile" +
        (onMenu && !inert ? " long-press" : "") +
        (highlight ? " is-highlight" : "") +
        (inert ? " is-inert" : "")
      }
      {...longPress}
    >
      <button
        type="button"
        className="routine-tile-open"
        aria-label={openLabel}
        tabIndex={inert ? -1 : undefined}
        onClick={inert ? undefined : onOpen}
      >
        <span className="routine-tile-icons" aria-hidden="true">
          {icons.map((icon) => (
            <RoutineGlyph
              key={icon.category}
              exerciseId={icon.exerciseId}
              category={icon.category}
            />
          ))}
          {more > 0 && <span className="routine-tile-more">+{more}</span>}
        </span>
        <span className="routine-tile-name">
          {namePieces(name).map((piece, index) => (
            <Fragment key={index}>
              {index > 0 && <wbr />}
              {piece}
            </Fragment>
          ))}
          {shared && (
            <span className="routine-tile-globe">
              <Globe size={14} aria-hidden="true" />
              <span className="sr-only">{t("routineTile.shared")}</span>
            </span>
          )}
        </span>
        <span className="routine-tile-meta">{meta}</span>
        <span className="routine-tile-foot">{foot}</span>
      </button>
      {onMenu && (
        <button
          type="button"
          className="icon-btn routine-tile-menu"
          aria-label={menuLabel}
          aria-haspopup="dialog"
          tabIndex={inert ? -1 : undefined}
          onClick={inert ? undefined : onMenu}
        >
          <MoreHorizontal size={20} aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        className={"routine-tile-action is-" + action.kind}
        aria-label={action.label}
        disabled={action.disabled || action.kind === "saved"}
        tabIndex={inert ? -1 : undefined}
        onClick={inert ? undefined : action.onClick}
      >
        <ActionIcon
          size={18}
          {...(action.kind === "start"
            ? { fill: "currentColor", stroke: "none" }
            : { strokeWidth: 2.4 })}
          aria-hidden="true"
        />
      </button>
    </div>
  );
});

export default RoutineTile;

/** The dashed tile after the routines: "+ Ny rutin" (or the draft to resume). */
export function NewRoutineTile({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="routine-tile-new"
      data-key="new"
      onClick={onClick}
    >
      <Plus size={22} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
