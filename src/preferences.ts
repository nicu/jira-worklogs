import { getPreferenceValues } from "@raycast/api";

type Preferences = {
  menubarTextMaxLength?: string;
};

const DEFAULT_MENUBAR_TEXT_MAX_LENGTH = 32;

export function getMenubarTextMaxLength(): number {
  const preferences = getPreferenceValues<Preferences>();
  const parsed = Number.parseInt(preferences.menubarTextMaxLength ?? "", 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MENUBAR_TEXT_MAX_LENGTH;
  }

  return parsed;
}
