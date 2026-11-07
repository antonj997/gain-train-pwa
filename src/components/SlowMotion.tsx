import { useEffect } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useSlowMotionSetting } from "@/hooks/useSlowMotion";
import {
  activeSlowMotion,
  setMotionScale,
  type SlowMotionScale,
} from "@/lib/slow-motion";
import { startSlowMotion } from "@/lib/slow-motion-player";
import { useT } from "@/i18n/useT";

/**
 * Slow motion's controller, at the app root: on only for a signed-in admin
 * who chose it on this device (Settings → Admin → Developer). While on it
 * slows every animation and shows a small pill that turns it off. With
 * nothing stored for the account it renders nothing and asks nothing, so
 * other accounts never pay for it.
 */
export default function SlowMotion() {
  const { userId, stored, set } = useSlowMotionSetting();
  if (!userId || stored === 1) return null;
  return (
    <AdminSlowMotion userId={userId} stored={stored} turnOff={() => set(1)} />
  );
}

function AdminSlowMotion({
  userId,
  stored,
  turnOff,
}: {
  userId: string;
  stored: SlowMotionScale;
  turnOff: () => void;
}) {
  const { t } = useT();
  const { isAdmin } = useAdmin();
  const scale = activeSlowMotion({ userId, isAdmin, stored });

  useEffect(() => {
    if (scale === 1) return;
    setMotionScale(scale);
    const stop = startSlowMotion(scale);
    return () => {
      stop();
      setMotionScale(1);
    };
  }, [scale]);

  if (scale === 1) return null;
  return (
    <button
      type="button"
      className="slow-motion-pill"
      aria-label={t("slowmo.pillLabel", { scale })}
      onClick={turnOff}
    >
      {t("slowmo.pill", { scale })}
    </button>
  );
}
