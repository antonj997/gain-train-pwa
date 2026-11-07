import { Link } from "react-router-dom";
import { UserRound } from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import { useDisplayName } from "@/hooks/useDisplayName";
import { useT } from "@/i18n/useT";

/**
 * Train's profile avatar at the top right: a round 44px button with the
 * signed-in user's initial (their name, else their email), or a person icon
 * when signed out. It opens Settings, which holds the account and sign-in.
 */
export default function ProfileButton() {
  const { user } = useAuth();
  const { name } = useDisplayName();
  const { t } = useT();
  const initial = (name?.trim()[0] ?? user?.email?.[0] ?? "").toUpperCase();
  return (
    <Link
      to="/settings"
      className={"profile-btn" + (user ? " is-signed-in" : "")}
      aria-label={t("home.profile")}
    >
      {user && initial ? (
        <span aria-hidden="true">{initial}</span>
      ) : (
        <UserRound size={22} aria-hidden="true" />
      )}
    </Link>
  );
}
