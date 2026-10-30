import { useEffect } from "react";
import Sheet from "@/components/ui/Sheet";
import { LanguageChoices } from "@/components/settings/PreferenceSheets";
import { useData } from "@/contexts/useData";
import { useProfile } from "@/contexts/useProfile";
import { hasUserData, languageOnLaunch } from "@/i18n";
import { useT } from "@/i18n/useT";

/**
 * Asks once which language to use, on a device that already holds a log from
 * before the app had a choice. Closing it keeps English. A new user gets
 * English without being asked. Rendered once the log has loaded.
 */
export default function LanguagePrompt() {
  const { state } = useData();
  const { bodyWeightKg } = useProfile();
  const { chosen, language, setLanguage } = useT();
  const action = languageOnLaunch(
    chosen ? language : null,
    hasUserData(state.records, { bodyWeightKg }),
  );
  useEffect(() => {
    if (action === "default") setLanguage("en");
  }, [action, setLanguage]);
  if (action !== "prompt") return null;
  return (
    <Sheet
      open
      onClose={() => setLanguage("en")}
      title="Choose your language · Välj språk"
      description="You can change it later in Settings · Du kan ändra det senare i Inställningar"
    >
      <LanguageChoices onChoose={setLanguage} />
    </Sheet>
  );
}
