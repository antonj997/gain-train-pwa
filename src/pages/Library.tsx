import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Segmented from "@/components/ui/Segmented";
import RoutinesPanel from "@/components/library/RoutinesPanel";
import ExercisesPanel, {
  type PanelRequest,
} from "@/components/library/ExercisesPanel";
import DiscoverPanel from "@/components/library/DiscoverPanel";
import { useT } from "@/i18n/useT";

type Tab = "routines" | "exercises" | "discover";
const tabs = [
  { value: "routines", label: "library.routines" },
  { value: "exercises", label: "library.exercises" },
  { value: "discover", label: "library.discover" },
] as const;
const tabOf = (value: string | null): Tab =>
  value === "exercises" || value === "discover" ? value : "routines";

/**
 * Library, the training setup, in three tabs chosen with `?tab=`: Rutiner
 * (your routines as tiles, with folders), Övningar (the catalogue plus your
 * own) and Upptäck (what people shared: routines and exercises). The header's
 * Search acts on the chosen tab, and + makes a routine or an exercise. Plan
 * is a subscreen (/library/plan); /library/shared now opens Upptäck.
 */
export default function Library() {
  const [params, setParams] = useSearchParams();
  const { t } = useT();
  const tab = tabOf(params.get("tab"));
  const [request, setRequest] = useState<PanelRequest>(null);
  const ask = (kind: "new" | "search") =>
    setRequest((r) => ({ kind, n: (r?.n ?? 0) + 1 }));
  return (
    <div className="page library-page">
      <PageHeader
        title={t("library.title")}
        action={
          <div className="page-header-actions">
            <button
              type="button"
              className="icon-btn"
              aria-label={t(
                tab === "routines"
                  ? "library.searchRoutines"
                  : tab === "exercises"
                    ? "library.searchExercises"
                    : "library.searchDiscover",
              )}
              onClick={() => ask("search")}
            >
              <Search size={22} aria-hidden="true" />
            </button>
            {tab !== "discover" && (
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
            )}
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
      {tab === "routines" && <RoutinesPanel request={request} />}
      {tab === "exercises" && <ExercisesPanel request={request} />}
      {tab === "discover" && <DiscoverPanel request={request} />}
    </div>
  );
}
