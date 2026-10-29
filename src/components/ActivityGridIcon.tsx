/** A small grid of rounded squares, drawn like the lucide icons it sits beside. */
export default function ActivityGridIcon({ size = 22 }: { size?: number }) {
  const squares = [4, 10, 16].flatMap((x) =>
    [1, 7, 13, 19].map((y) => ({ x, y })),
  );
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {squares.map(({ x, y }, index) => (
        <rect
          key={index}
          x={x}
          y={y}
          width="4"
          height="4"
          rx="1.2"
          opacity={index % 3 === 0 ? 1 : index % 3 === 1 ? 0.55 : 0.28}
        />
      ))}
    </svg>
  );
}
