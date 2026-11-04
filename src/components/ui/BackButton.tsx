import { ChevronLeft } from "lucide-react";
import { useT } from "@/i18n/useT";

/** The one Back control: a chevron icon button for a page header's leading slot. */
export default function BackButton({ onClick }: { onClick: () => void }) {
  const { t } = useT();
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={t("common.back")}
      onClick={onClick}
    >
      <ChevronLeft size={22} aria-hidden="true" />
    </button>
  );
}
