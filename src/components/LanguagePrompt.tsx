import { useEffect } from "react";
import Sheet from "@/components/ui/Sheet";
import { LanguageChoices } from "@/components/settings/PreferenceSheets";
import { useData } from "@/contexts/useData";
import { useProfile } from "@/contexts/useProfile";
import { hasUserData, languageOnLaunch, readLanguageSetting } from "@/i18n";
import { useT } from "@/i18n/useT";
import { setTipBlocker } from "@/lib/tip-store";

/**
 * Asks once which language to use, on a device that already holds a log from
 * before the app had a choice. Closing it keeps English. A new user follows
 * the phone's language without being asked, and nothing is stored until they
 * choose in Settings. Rendered once the log has loaded.
 */
export default function LanguagePrompt() {
  const { state } = useData();
  const { bodyWeightKg } = useProfile();
  const { chosen, language, setLanguage, followPhone } = useT();
  const action = languageOnLaunch(
    chosen ? language : readLanguageSetting(),
    hasUserData(state.records, { bodyWeightKg }),
  );
  useEffect(() => {
    if (action === "phone") followPhone();
  }, [action, followPhone]);
  // No tip shows over the first-launch prompt.
  const prompting = action === "prompt";
  useEffect(() => {
    if (!prompting) return;
    setTipBlocker("language", true);
    return () => setTipBlocker("language", false);
  }, [prompting]);
  if (action !== "prompt") return null;
  return (
    <Sheet
      open
      onClose={() => setLanguage("en")}
      title="Choose your language · Välj språk"
      description="Change it later in Settings · Ändra senare i Inställningar"
    >
      <LanguageChoices onChoose={setLanguage} />
    </Sheet>
  );
}
