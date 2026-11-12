import type { HTMLAttributes, ReactNode } from "react";
import { useListMotion, type ListMotionOptions } from "@/hooks/useListMotion";

type Props = HTMLAttributes<HTMLDivElement> &
  ListMotionOptions & { children?: ReactNode };

/**
 * A list (a div) whose items grow in, fold away and slide when they come,
 * go or move (useListMotion). Pass `resetKey` for anything that swaps the
 * whole list, such as a search or a filter.
 */
export default function MotionList({
  resetKey,
  kind,
  fromEmpty,
  children,
  ...rest
}: Props) {
  const ref = useListMotion<HTMLDivElement>({ resetKey, kind, fromEmpty });
  return (
    <div ref={ref} data-list-motion="" {...rest}>
      {children}
    </div>
  );
}
