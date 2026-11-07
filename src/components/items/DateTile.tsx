import { localizedDate } from "@/lib/dates";

/**
 * A workout's date as a small calendar page: a done-coloured band with the
 * short weekday over the day number. Screen readers hear the full date.
 */
export default function DateTile({ date }: { date: string }) {
  const weekday = localizedDate(date, { weekday: "short" }).replace(".", "");
  return (
    <span className="date-tile">
      <span className="date-tile-band" aria-hidden="true">
        {weekday}
      </span>
      <span className="date-tile-day" aria-hidden="true">
        {Number(date.slice(8, 10))}
      </span>
      <span className="sr-only">
        {localizedDate(date, {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
        {", "}
      </span>
    </span>
  );
}
