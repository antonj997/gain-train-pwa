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
import PlanPanel from "@/components/plan/PlanPanel";
import {
  LIBRARY_TABS,
  ROUTINE_VIEWS,
  libraryTabOf,
  routinesViewOf,
  type LibraryTab,
  type RoutinesView,
} from "@/lib/library-tabs";
import { useT } from "@/i18n/useT";

/**
 * Library, the training setup, in three tabs chosen with `?tab=` (v6 §E1):
 * Rutiner (your routines as tiles, with folders; its "Mina | Upptäck"
 * segment, `?view=discover`, shows the standard programmes and what people
 * shared), Övningar (the catalogue plus your own) and Scheman (the plans,
 * `?tab=plans`). The header's Search acts on the chosen part, and + makes a
 * routine, an exercise or a plan.
 */
export default function Library() {
  const [params, setParams] = useSearchParams();
  const { t } = useT();
  const tab = libraryTabOf(params.get("tab"));
  const view = routinesViewOf(params.get("view"));
  const discover = tab === "routines" && view === "discover";
  const [request, setRequest] = useState<PanelRequest>(null);
  const ask = (kind: "new" | "search") =>
    setRequest((r) => ({ kind, n: (r?.n ?? 0) + 1 }));
  const searchLabel = discover
    ? t("library.searchDiscover")
    : tab === "routines"
      ? t("library.searchRoutines")
      : t("library.searchExercises");
  const newLabel =
    tab === "routines"
      ? t("routines.new")
      : tab === "exercises"
        ? t("exercises.new")
        : t("plan.new");
  return (
    <div className="page library-page">
      <PageHeader
        title={t("library.title")}
        action={
          <div className="page-header-actions">
            {tab !== "plans" && (
              <button
                type="button"
                className="icon-btn"
                aria-label={searchLabel}
                onClick={() => ask("search")}
              >
                <Search size={22} aria-hidden="true" />
              </button>
            )}
            {!discover && (
              <button
                type="button"
                className="icon-btn filled"
                aria-label={newLabel}
                onClick={() => ask("new")}
              >
                <Plus size={22} aria-hidden="true" />
              </button>
            )}
          </div>
        }
      />
      <Segmented<LibraryTab>
        label={t("library.section")}
        value={tab}
        options={LIBRARY_TABS.map(({ value, label }) => ({
          value,
          label: t(label),
        }))}
        onChange={(next) =>
          setParams(next === "routines" ? {} : { tab: next }, { replace: true })
        }
      />
      {tab === "routines" && (
        <Segmented<RoutinesView>
          label={t("library.routinesView")}
          value={view}
          options={ROUTINE_VIEWS.map(({ value, label }) => ({
            value,
            label: t(label),
          }))}
          onChange={(next) =>
            setParams(next === "mine" ? {} : { view: next }, {
              replace: true,
            })
          }
        />
      )}
      {tab === "routines" && !discover && <RoutinesPanel request={request} />}
      {discover && <DiscoverPanel request={request} />}
      {tab === "exercises" && <ExercisesPanel request={request} />}
      {tab === "plans" && <PlanPanel />}
    </div>
  );
}
