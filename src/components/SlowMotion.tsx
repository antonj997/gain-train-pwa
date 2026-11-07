import { useEffect } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useSlowMotionSetting } from "@/hooks/useSlowMotion";
import { activeSlowMotion, setMotionScale } from "@/lib/slow-motion";
import { startSlowMotion } from "@/lib/slow-motion-player";
import { useT } from "@/i18n/useT";

/**
 * Slow motion's controller, at the app root: on only for a signed-in admin
 * who chose it on this device (Settings → Admin → Developer). While on it
 * slows every animation and shows a small pill that turns it off.
 */
export default function SlowMotion() {
  const { t } = useT();
  const { isAdmin } = useAdmin();
  const { userId, stored, set } = useSlowMotionSetting();
  const scale = activeSlowMotion({ userId, isAdmin, stored });

  useEffect(() => {
    setMotionScale(scale);
    if (scale === 1) return;
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
      onClick={() => set(1)}
    >
      {t("slowmo.pill", { scale })}
    </button>
  );
}
