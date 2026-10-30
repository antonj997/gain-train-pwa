import { t } from "../i18n";

export const DISPLAY_NAME_MAX = 40;

/**
 * The display name to save from what was typed: spaces collapsed and control
 * characters removed. Null clears the name. Throws when it is too long.
 */
export function normalizeDisplayName(input: string): string | null {
  // eslint-disable-next-line no-control-regex
  const name = input.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!name) return null;
  if ([...name].length > DISPLAY_NAME_MAX)
    throw new Error(t("name.tooLong", { max: DISPLAY_NAME_MAX }));
  return name;
}

/** "by Anna", or "by someone" for a sharer without a display name. */
export const sharedByLine = (name: string | null | undefined) => {
  const clean = typeof name === "string" ? name.trim().slice(0, 60) : "";
  return clean ? t("shared.by", { name: clean }) : t("shared.bySomeone");
};
