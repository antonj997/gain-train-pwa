import { useState } from "react";
import { CalendarDays, Globe, Library, Play, Plus } from "lucide-react";
import ListRow from "@/components/ui/ListRow";
import { LanguageSheet } from "@/components/settings/PreferenceSheets";
import { LANGUAGE_NAMES } from "@/i18n";
import { useT } from "@/i18n/useT";
import { discoverPath, newPlanPath } from "@/lib/routes";

/**
 * The new routine's editor in Library. Library (P4) opens it on `?new=routine`;
 * until then the link lands on Rutiner, where + makes one.
 */
const NEW_ROUTINE_PATH = "/library?new=routine";

/**
 * Train's Today card on first start (v6 A1): nothing is planned and nothing
 * is logged yet, so it says how the app works and starts an empty workout.
 * It is the only way to an empty workout on this screen (F-P3.34).
 */
export function FirstStartCard({
  starting,
  onStartEmpty,
}: {
  starting: boolean;
  onStartEmpty: () => void;
}) {
  const { t } = useT();
  return (
    <section className="today-card" aria-labelledby="first-start-heading">
      <p className="today-label first-start-label">{t("home.firstLabel")}</p>
      <span className="today-text">
        <strong id="first-start-heading" className="today-title">
          {t("home.firstTitle")}
        </strong>
        <span className="row-sub">{t("home.firstText")}</span>
      </span>
      <button
        type="button"
        className="btn-primary btn-block btn-lg"
        disabled={starting}
        onClick={onStartEmpty}
      >
        <Play size={18} fill="currentColor" stroke="none" aria-hidden="true" />
        {starting ? t("home.starting") : t("home.firstStart")}
      </button>
    </section>
  );
}

/**
 * "Kom igång" on first start (v6 A1): three rows with plain glyphs (a ready
 * routine in Upptäck, your own routine, a plan), then the language row, which
 * says when the language follows the phone and opens the language sheet.
 */
export function GetStarted() {
  const { t, language, followsPhone } = useT();
  const [sheet, setSheet] = useState(false);
  const languageValue = followsPhone
    ? t("settings.languagePhone", { language: LANGUAGE_NAMES[language] })
    : LANGUAGE_NAMES[language];
  const glyph = (Icon: typeof Plus) => (
    <span className="get-started-glyph" aria-hidden="true">
      <Icon size={22} />
    </span>
  );
  return (
    <>
      <section className="get-started" aria-labelledby="get-started-heading">
        <h2 id="get-started-heading" className="group-title">
          {t("home.getStarted")}
        </h2>
        <div className="list">
          <ListRow
            className="get-started-row"
            to={discoverPath()}
            leading={glyph(Library)}
            title={t("home.getRoutine")}
            sub={t("home.getRoutineSub")}
            chevron
          />
          <ListRow
            className="get-started-row"
            to={NEW_ROUTINE_PATH}
            leading={glyph(Plus)}
            title={t("home.getBuild")}
            sub={t("home.getBuildSub")}
            chevron
          />
          <ListRow
            className="get-started-row"
            to={newPlanPath()}
            leading={glyph(CalendarDays)}
            title={t("home.getPlan")}
            sub={t("home.getPlanSub")}
            chevron
          />
        </div>
      </section>
      <div className="list">
        <ListRow
          className="language-row"
          onClick={() => setSheet(true)}
          leading={glyph(Globe)}
          title={t("settings.languageRow")}
          sub={languageValue}
          chevron
        />
      </div>
      <LanguageSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}
