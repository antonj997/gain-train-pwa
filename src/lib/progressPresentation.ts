import { localizedDate } from "./dates";

export function chartSessions<T extends { date: string; workoutId: string }>(
  points: T[],
  locale?: string,
) {
  const totals = new Map<string, number>();
  const ordinals = new Map<string, number>();
  points.forEach((point) =>
    totals.set(point.date, (totals.get(point.date) ?? 0) + 1),
  );
  return points.map((point) => {
    const ordinal = (ordinals.get(point.date) ?? 0) + 1;
    ordinals.set(point.date, ordinal);
    const date = localizedDate(
      point.date,
      { day: "numeric", month: "short" },
      locale,
    );
    return {
      ...point,
      label: date + (totals.get(point.date)! > 1 ? ` · ${ordinal}` : ""),
      fullLabel:
        localizedDate(point.date, undefined, locale) +
        (totals.get(point.date)! > 1 ? ` · Session ${ordinal}` : ""),
    };
  });
}

export function chartDomain(values: number[]): [number, number] {
  return [0, Math.max(1, Math.ceil(Math.max(0, ...values) * 1.1))];
}
