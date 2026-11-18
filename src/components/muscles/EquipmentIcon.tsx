import { memo } from "react";
import { EQUIPMENT_SHAPES, type EquipmentIconKind } from "./equipment-shapes";

/**
 * An equipment glyph for your own exercises, drawn in the current text colour
 * like a Lucide icon. Decorative: the exercise's name always sits next to it.
 */
function EquipmentIcon({
  kind,
  size = 22,
  className,
}: {
  kind: EquipmentIconKind;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-equipment={kind}
    >
      {EQUIPMENT_SHAPES[kind].map((shape, index) =>
        typeof shape === "string" ? (
          <path key={index} d={shape} />
        ) : (
          <circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} />
        ),
      )}
    </svg>
  );
}

export default memo(EquipmentIcon);
