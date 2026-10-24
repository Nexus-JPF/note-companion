import type { FileOrganizerSettings } from "./settings";

/**
 * The wizard opens by itself only for a brand-new install: no license key,
 * not self-hosting, and it has never been shown or completed.
 */
export function shouldAutoOpenOnboarding(
  settings: Pick<
    FileOrganizerSettings,
    "hasRunOnboarding" | "hasShownOnboarding" | "API_KEY" | "enableSelfHosting"
  >
): boolean {
  return !(
    settings.hasRunOnboarding ||
    settings.hasShownOnboarding ||
    settings.API_KEY ||
    settings.enableSelfHosting
  );
}
