import React, { useEffect, useState } from "react";
import { Notice } from "obsidian";
import type FileOrganizer from "../index";
import { StyledContainer } from "./ui/utils";
import { tw } from "../lib/utils";
import {
  MARKETING_CONSENT_TEXT,
  canAskMarketingConsent,
  fetchMarketingConsent,
  saveMarketingConsent,
} from "../lib/marketing-consent";

/**
 * One-time row under the sidebar tabs asking whether the user wants product
 * update emails. Nothing is pre-selected: only a click on "Yes" opts in.
 * Hidden once answered here, in settings, or on the web dashboard.
 */
export function MarketingConsentPrompt({ plugin }: { plugin: FileOrganizer }) {
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const markAsked = async () => {
    plugin.settings.marketingConsentAsked = true;
    await plugin.saveSettings();
  };

  useEffect(() => {
    if (
      plugin.settings.marketingConsentAsked ||
      !plugin.settings.hasRunOnboarding ||
      !canAskMarketingConsent(plugin)
    ) {
      return;
    }
    let cancelled = false;
    void fetchMarketingConsent(plugin).then(state => {
      if (cancelled || !state) return;
      if (state.decided) void markAsked();
      else setVisible(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plugin]);

  if (!visible) return null;

  const answer = async (optIn: boolean) => {
    setSaving(true);
    const ok = await saveMarketingConsent(plugin, optIn);
    setSaving(false);
    if (!ok) {
      new Notice("Could not save your email preference. Please try again.");
      return;
    }
    await markAsked();
    setVisible(false);
    if (optIn) new Notice("You'll get Note Companion product updates by email.");
  };

  return (
    <StyledContainer className={tw("h-auto")}>
      <div
        className={tw(
          "flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[--background-modifier-border] text-[--font-ui-smaller]"
        )}
      >
        <div className={tw("flex-1 min-w-[12rem]")}>
          <span className={tw("text-[--text-normal]")}>
            Get product updates by email?
          </span>{" "}
          <span className={tw("text-[--text-muted]")}>
            {MARKETING_CONSENT_TEXT}
          </span>
        </div>
        <div className={tw("flex gap-2")}>
          <button disabled={saving} onClick={() => void answer(false)}>
            No thanks
          </button>
          <button
            className="mod-cta"
            disabled={saving}
            onClick={() => void answer(true)}
          >
            Yes
          </button>
        </div>
      </div>
    </StyledContainer>
  );
}
