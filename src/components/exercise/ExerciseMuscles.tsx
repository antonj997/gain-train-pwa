import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { ExerciseMuscles as Muscles, Muscle } from "@/data/muscles";
import { helpingMuscles, mainMuscles } from "@/data/exercise-muscles";
import MapLegend from "@/components/muscles/MapLegend";
import MuscleMap from "@/components/muscles/MuscleMap";
import { useMapFigure } from "@/hooks/useMapFigure";
import { muscleLabel } from "@/lib/catalogue-labels";
import { exerciseMapFills } from "@/lib/muscle-figure";
import { useT } from "@/i18n/useT";

function MuscleList({
  id,
  title,
  muscles,
  level,
}: {
  id: string;
  title: string;
  muscles: readonly Muscle[];
  level: "main" | "help";
}) {
  return (
    <div className="muscle-group">
      <h3 id={id}>{title}</h3>
      <ul className="muscle-list" aria-labelledby={id}>
        {muscles.map((muscle) => (
          <li key={muscle}>
            <span className={"muscle-dot is-" + level} aria-hidden="true" />
            {muscleLabel(muscle)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The exercise page's Muscles card: the detailed map (main muscles red,
 * helping ones light pink) with its key, and the muscles listed as main and
 * helping. Your own exercise without muscles offers to choose them.
 */
export default function ExerciseMuscles({
  muscles,
  editPath,
}: {
  muscles: Muscles;
  /** Your own exercise's editor, where its muscles are chosen. */
  editPath?: string;
}) {
  const { t } = useT();
  const [figure] = useMapFigure();
  const { fills, rank } = useMemo(() => exerciseMapFills(muscles), [muscles]);
  const main = mainMuscles(muscles);
  const helping = helpingMuscles(muscles);
  if (!main.length && !helping.length && !editPath) return null;
  return (
    <section className="card overview-card" aria-labelledby="exercise-muscles">
      <div className="overview-head">
        <h2 id="exercise-muscles">{t("muscles.title")}</h2>
      </div>
      <div className="muscle-map">
        <MuscleMap fills={fills} rank={rank} figure={figure} />
        <MapLegend
          items={[
            {
              key: "main",
              colour: "var(--gt-map-main)",
              label: t("muscles.main"),
            },
            {
              key: "help",
              colour: "var(--gt-map-help)",
              label: t("muscles.helping"),
            },
            {
              key: "off",
              colour: "var(--gt-map-off)",
              label: t("muscles.untrained"),
            },
          ]}
        />
      </div>
      {main.length || helping.length ? (
        <div className="muscle-groups">
          {main.length > 0 && (
            <MuscleList
              id="exercise-muscles-main"
              title={t("muscles.main")}
              muscles={main}
              level="main"
            />
          )}
          {helping.length > 0 && (
            <MuscleList
              id="exercise-muscles-help"
              title={t("muscles.helping")}
              muscles={helping}
              level="help"
            />
          )}
        </div>
      ) : (
        <div className="muscle-empty">
          <p className="row-sub">{t("muscles.noneChosen")}</p>
          {editPath && (
            <Link className="text-link" to={editPath}>
              {t("muscles.choose")}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
