import { Link } from "react-router-dom";
import { useT } from "@/i18n/useT";
export default function NotFound() {
  const { t } = useT();
  return (
    <div className="empty-card">
      <h1>{t("notFound.title")}</h1>
      <p>{t("notFound.text")}</p>
      <Link to="/" className="secondary">
        {t("notFound.back")}
      </Link>
    </div>
  );
}
