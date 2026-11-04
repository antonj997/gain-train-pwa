import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import BackButton from "@/components/ui/BackButton";
import { usePageBack } from "@/hooks/usePageTransitions";
import { useT } from "@/i18n/useT";

/** Any route the app does not know: the shared header and a way back to Train. */
export default function NotFound() {
  const { t } = useT();
  const back = usePageBack("/");
  return (
    <div className="page not-found-page">
      <PageHeader
        eyebrow={t("notFound.eyebrow")}
        title={t("notFound.title")}
        notices={false}
        leading={<BackButton onClick={back} />}
      />
      <div className="empty-card" role="status">
        <p>{t("notFound.text")}</p>
        <Link to="/" className="btn-secondary">
          {t("notFound.back")}
        </Link>
      </div>
    </div>
  );
}
