import { useSearchParams } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import Segmented from "@/components/ui/Segmented";
import RoutinesPanel from "@/components/library/RoutinesPanel";
import ExercisesPanel from "@/components/library/ExercisesPanel";

type Tab = "routines" | "exercises";
const tabs: { value: Tab; label: string }[] = [
  { value: "routines", label: "Routines" },
  { value: "exercises", label: "Exercises" },
];

/** Library: routines and exercises, chosen with `?tab=`. */
export default function Library() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "exercises" ? "exercises" : "routines";
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
      {tab === "routines" ? <RoutinesPanel /> : <ExercisesPanel />}
    </div>
  );
}
