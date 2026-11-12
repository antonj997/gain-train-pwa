import { memo, useMemo } from "react";
import type { RecordDoc } from "@/data/model";
import {
  WEEKLY_SET_GUIDE,
  weeklyMuscleSets,
  type MuscleSetRow,
} from "@/data/muscle-sets";
import { categoryLabel } from "@/lib/catalogue-labels";
import { isoWeek } from "@/lib/dates";
import { formatDecimal } from "@/i18n";
import { useT } from "@/i18n/useT";

type Props = {
  records: readonly RecordDoc[];
  now: string;
};

const pct = (value: number, scale: number) =>
  `${Math.min(100, Math.max(0, (value / scale) * 100))}%`;

/**
 * Progress' "Sets per muscle group": this week's hard sets per group as a
 * compact bar list, with the 10–20 sets a week guide as a band on every track.
 * A group under the guide has a muted bar.
 */
function MuscleSets({ records, now }: Props) {
  const { t, language } = useT();
  const week = useMemo(
    () => weeklyMuscleSets(records, now),
    // The group names follow the language too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, now, language],
  );
  const weekNumber = isoWeek(now);
  const { min, max } = WEEKLY_SET_GUIDE;
  const status = (row: MuscleSetRow) => t(`muscle.${row.status}`);
  return (
    <section className="muscle-sets" aria-labelledby="muscle-heading">
      <div className="section-head">
        <h2 id="muscle-heading">{t("muscle.title")}</h2>
        <span
          className="row-sub"
          aria-label={t("muscle.weekLabel", { week: weekNumber, min, max })}
        >
          {t("muscle.week", { week: weekNumber, min, max })}
        </span>
      </div>
      {week.rows.length === 0 ? (
        <p className="row-sub" role="status">
          {t("muscle.empty")}
        </p>
      ) : (
        <ul className="muscle-list">
          {week.rows.map((row) => {
            const group = categoryLabel(row.group);
            const sets = formatDecimal(row.sets);
            return (
              <li
                key={row.group}
                className="muscle-row"
                data-status={row.status}
                aria-label={t("muscle.row", {
                  group,
                  sets,
                  status: status(row),
                })}
              >
                <span className="muscle-name" aria-hidden="true">
                  {group}
                </span>
                <span className="muscle-track" aria-hidden="true">
                  <span
                    className="muscle-guide"
                    style={{
                      left: pct(min, week.scale),
                      width: `calc(${pct(max, week.scale)} - ${pct(min, week.scale)})`,
                    }}
                  />
                  <span
                    className="muscle-fill"
                    style={{ width: pct(row.sets, week.scale) }}
                  />
                </span>
                <strong className="muscle-value" aria-hidden="true">
                  {sets}
                </strong>
              </li>
            );
          })}
        </ul>
      )}
      <p className="row-sub muscle-note">{t("muscle.note")}</p>
    </section>
  );
}

export default memo(MuscleSets);
