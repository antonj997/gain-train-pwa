import { useSearchParams } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import Segmented from "@/components/ui/Segmented";
import RoutinesPanel from "@/components/library/RoutinesPanel";
import ExercisesPanel from "@/components/library/ExercisesPanel";
import PlanPanel from "@/components/plan/PlanPanel";
import { useT } from "@/i18n/useT";

type Tab = "routines" | "exercises" | "plan";
const tabs = [
  { value: "routines", label: "library.routines" },
  { value: "exercises", label: "library.exercises" },
  { value: "plan", label: "library.plan" },
] as const;

/** Library: routines, exercises and the optional plan, chosen with `?tab=`. */
export default function Library() {
  const [params, setParams] = useSearchParams();
  const { t } = useT();
  const requested = params.get("tab");
  const tab: Tab =
    requested === "exercises" || requested === "plan" ? requested : "routines";
  return (
    <div className="page library-page">
      <PageHeader eyebrow={t("library.eyebrow")} title={t("library.title")} />
      <Segmented<Tab>
        label={t("library.section")}
        value={tab}
        options={tabs.map(({ value, label }) => ({ value, label: t(label) }))}
        onChange={(next) =>
          setParams(next === "routines" ? {} : { tab: next }, { replace: true })
        }
      />
      {tab === "routines" && <RoutinesPanel />}
      {tab === "exercises" && <ExercisesPanel />}
      {tab === "plan" && <PlanPanel />}
    </div>
  );
}
