import Segmented from "@/components/ui/Segmented";
import { useSlowMotionSetting } from "@/hooks/useSlowMotion";
import { SLOW_MOTION_SCALES, parseSlowMotion } from "@/lib/slow-motion";
import { useT } from "@/i18n/useT";

const reducedMotion = () =>
  globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Settings → Admin → Developer: tools for reviewing the app, on this device only. */
export default function DeveloperSection() {
  const { t } = useT();
  const { stored, set } = useSlowMotionSetting();
  const options = SLOW_MOTION_SCALES.map((scale) => ({
    value: String(scale),
    label: scale === 1 ? t("common.off") : t("slowmo.option", { scale }),
  }));
  return (
    <section className="developer-section" aria-labelledby="developer-title">
      <h2 id="developer-title" className="group-title">
        {t("admin.developer")}
      </h2>
      <div className="card developer-card">
        <h3 className="developer-label">{t("slowmo.title")}</h3>
        <Segmented
          label={t("slowmo.title")}
          value={String(stored)}
          options={options}
          onChange={(value) => set(parseSlowMotion(value))}
        />
        <p className="row-sub">
          {t("slowmo.note")}
          {reducedMotion() && <> {t("slowmo.reducedNote")}</>}
        </p>
      </div>
    </section>
  );
}
