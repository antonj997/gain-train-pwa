import { Star } from "lucide-react";
import { t } from "@/i18n";

/** A favourite's mark next to its name in a list. Not a control: Favourite is in the exercise's menu. */
export default function FavouriteStar() {
  return (
    <span className="fav-star">
      <Star size={15} fill="currentColor" aria-hidden="true" />
      <span className="sr-only">{t("exercises.favouriteSr")}</span>
    </span>
  );
}
