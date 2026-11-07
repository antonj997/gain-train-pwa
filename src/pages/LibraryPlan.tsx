import PageHeader from "@/components/PageHeader";
import BackButton from "@/components/ui/BackButton";
import PlanPanel from "@/components/plan/PlanPanel";
import { usePageBack } from "@/hooks/usePageTransitions";
import { useT } from "@/i18n/useT";

/**
 * Library → Plan, a subscreen: the plans (phases, deload, progression) with
 * their editor, and groups under Advanced. Reached from the phase card on
 * Library → Routines and from Train's Today ⋯.
 */
export default function LibraryPlan() {
  const { t } = useT();
  const back = usePageBack("/library");
  return (
    <div className="page library-page plan-page">
      <PageHeader
        eyebrow={t("library.title")}
        title={t("library.planTitle")}
        leading={<BackButton onClick={back} />}
      />
      <PlanPanel />
    </div>
  );
}
