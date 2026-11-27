import React, { useEffect, useState } from "react";
import { Notice } from "obsidian";
import type FileOrganizer from "../index";
import { tw } from "../lib/utils";
import {
  MARKETING_CONSENT_TEXT,
  canAskMarketingConsent,
  fetchMarketingConsent,
  saveMarketingConsent,
} from "../lib/marketing-consent";

/** Product-update email switch for the React settings screen (Obsidian < 1.13). */
export function MarketingConsentToggle({ plugin }: { plugin: FileOrganizer }) {
  const [optedIn, setOptedIn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchMarketingConsent(plugin).then(state => {
      if (!cancelled && state) setOptedIn(state.optedIn);
    });
    return () => {
      cancelled = true;
    };
  }, [plugin]);

  if (!canAskMarketingConsent(plugin) || optedIn === null) return null;

  const toggle = async () => {
    const next = !optedIn;
    setSaving(true);
    const ok = await saveMarketingConsent(plugin, next);
    setSaving(false);
    if (!ok) {
      new Notice("Could not save your email preference. Please try again.");
      return;
    }
    setOptedIn(next);
    plugin.settings.marketingConsentAsked = true;
    await plugin.saveSettings();
  };

  return (
    <div
      className={tw(
        "flex items-center justify-between gap-4 py-2 border-t border-[--background-modifier-border]"
      )}
    >
      <div>
        <div className={tw("text-[--text-normal]")}>Product update emails</div>
        <div className={tw("text-[--font-ui-smaller] text-[--text-muted]")}>
          {MARKETING_CONSENT_TEXT}
        </div>
      </div>
      <div
        className={`checkbox-container${optedIn ? " is-enabled" : ""}`}
        role="switch"
        aria-checked={optedIn}
        aria-label="Product update emails"
        aria-disabled={saving}
        tabIndex={0}
        onClick={() => {
          if (!saving) void toggle();
        }}
        onKeyDown={e => {
          if ((e.key === " " || e.key === "Enter") && !saving) {
            e.preventDefault();
            void toggle();
          }
        }}
      />
    </div>
  );
}
