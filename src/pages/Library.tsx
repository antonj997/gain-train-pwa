import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Segmented from "@/components/ui/Segmented";
import RoutinesPanel from "@/components/library/RoutinesPanel";
import ExercisesPanel, {
  type PanelRequest,
} from "@/components/library/ExercisesPanel";
import { useT } from "@/i18n/useT";

type Tab = "routines" | "exercises";
const tabs = [
  {
    value: "routines",
    label: "library.routines",
    help: "library.helpRoutines",
  },
  {
    value: "exercises",
    label: "library.exercises",
    help: "library.helpExercises",
  },
] as const;

/**
 * Library, the training setup: routines (the workouts you repeat, with the
 * plan's phase card on top and shared routines at the end) and exercises (the
 * catalogue plus your own), chosen with `?tab=`. The header's Search and +
 * act on the chosen section. Plan and Shared routines are subscreens
 * (/library/plan, /library/shared).
 */
export default function Library() {
  const [params, setParams] = useSearchParams();
  const { t } = useT();
  const tab: Tab = params.get("tab") === "exercises" ? "exercises" : "routines";
  const [request, setRequest] = useState<PanelRequest>(null);
  const ask = (kind: "new" | "search") =>
    setRequest((r) => ({ kind, n: (r?.n ?? 0) + 1 }));
  return (
    <div className="page library-page">
      <PageHeader
        eyebrow={t("library.eyebrow")}
        title={t("library.title")}
        action={
          <div className="page-header-actions">
            <button
              type="button"
              className="icon-btn"
              aria-label={t(
                tab === "routines"
                  ? "library.searchRoutines"
                  : "library.searchExercises",
              )}
              onClick={() => ask("search")}
            >
              <Search size={22} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-btn filled"
              aria-label={t(
                tab === "routines" ? "routines.new" : "exercises.new",
              )}
              onClick={() => ask("new")}
            >
              <Plus size={22} aria-hidden="true" />
            </button>
          </div>
        }
      />
      <Segmented<Tab>
        label={t("library.section")}
        value={tab}
        options={tabs.map(({ value, label }) => ({ value, label: t(label) }))}
        onChange={(next) =>
          setParams(next === "routines" ? {} : { tab: next }, { replace: true })
        }
      />
      <p className="row-sub section-note library-help">
        {t(tabs.find((x) => x.value === tab)!.help)}
      </p>
      {tab === "routines" && <RoutinesPanel request={request} />}
      {tab === "exercises" && <ExercisesPanel request={request} />}
    </div>
  );
}
