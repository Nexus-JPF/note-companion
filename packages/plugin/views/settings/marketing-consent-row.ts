import type { Setting } from "obsidian";
import { Notice } from "obsidian";
import type FileOrganizer from "../../index";
import {
  MARKETING_CONSENT_TEXT,
  canAskMarketingConsent,
  fetchMarketingConsent,
  saveMarketingConsent,
} from "../../lib/marketing-consent";

/**
 * "Product update emails" row of the declarative settings tab. The choice is
 * stored on the server, so the toggle is read when the row is drawn and saved
 * on change. Returns a cleanup so a late response never touches a torn-down row.
 */
export function renderMarketingConsentRow(
  plugin: FileOrganizer,
  setting: Setting
): () => void {
  let disposed = false;
  setting.setName("Product update emails");

  if (!canAskMarketingConsent(plugin)) {
    setting.setDesc(
      plugin.settings.enableSelfHosting
        ? "Not available when self-hosting."
        : "Enter a license key to manage email preferences."
    );
    return () => {
      disposed = true;
    };
  }

  setting.setDesc("Loading...");
  setting.addToggle(toggle => {
    // setValue fires onChange; ignore the calls we make ourselves
    let settingProgrammatically = false;
    const setQuietly = (value: boolean) => {
      settingProgrammatically = true;
      toggle.setValue(value);
      settingProgrammatically = false;
    };

    toggle.setDisabled(true);
    toggle.onChange(async value => {
      if (settingProgrammatically) return;
      toggle.setDisabled(true);
      const ok = await saveMarketingConsent(plugin, value);
      if (disposed) return;
      toggle.setDisabled(false);
      if (!ok) {
        new Notice("Could not save your email preference. Please try again.");
        setQuietly(!value);
        return;
      }
      plugin.settings.marketingConsentAsked = true;
      await plugin.saveSettings();
    });

    void fetchMarketingConsent(plugin).then(state => {
      if (disposed) return;
      if (!state) {
        setting.setDesc("Email preferences are unavailable right now.");
        return;
      }
      setting.setDesc(MARKETING_CONSENT_TEXT);
      setQuietly(state.optedIn);
      toggle.setDisabled(false);
    });
  });

  return () => {
    disposed = true;
  };
}
