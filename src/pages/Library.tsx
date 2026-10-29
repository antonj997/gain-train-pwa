import { useSearchParams } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import Segmented from "@/components/ui/Segmented";
import RoutinesPanel from "@/components/library/RoutinesPanel";
import ExercisesPanel from "@/components/library/ExercisesPanel";
import PlanPanel from "@/components/plan/PlanPanel";

type Tab = "routines" | "exercises" | "plan";
const tabs: { value: Tab; label: string }[] = [
  { value: "routines", label: "Routines" },
  { value: "exercises", label: "Exercises" },
  { value: "plan", label: "Plan" },
];

/** Library: routines, exercises and the optional plan, chosen with `?tab=`. */
export default function Library() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: Tab =
    requested === "exercises" || requested === "plan" ? requested : "routines";
  return (
    <div className="page library-page">
      <PageHeader eyebrow="Your plans and exercises" title="Library" />
      <Segmented<Tab>
        label="Library section"
        value={tab}
        options={tabs}
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
