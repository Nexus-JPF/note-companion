import type FileOrganizer from "../index";
import { obsidianFetch } from "./obsidian-fetch";
import { readResponseJson } from "./api-json";

/**
 * Opt-in to Note Companion product update emails (campaigns). Signing up only
 * gets account emails and getting-started tips; campaigns go to people who
 * said yes here or in the web dashboard. The answer is stored on the server
 * (in Loops), so it is the same everywhere.
 */

export type MarketingConsent = { decided: boolean; optedIn: boolean };

export const MARKETING_CONSENT_TEXT =
  "New features, launches and occasional offers. Unsubscribe anytime.";

/** Only for a hosted account: self-hosted servers have no mailing list. */
export function canAskMarketingConsent(plugin: FileOrganizer): boolean {
  return !!plugin.settings.API_KEY && !plugin.settings.enableSelfHosting;
}

/** null when the server cannot tell (old server, no Loops, network error). */
export async function fetchMarketingConsent(
  plugin: FileOrganizer
): Promise<MarketingConsent | null> {
  if (!canAskMarketingConsent(plugin)) return null;
  try {
    const response = await obsidianFetch(
      `${plugin.getServerUrl()}/api/marketing-consent`,
      { headers: { Authorization: `Bearer ${plugin.getApiKey()}` } }
    );
    if (!response.ok) return null;
    const data = await readResponseJson<
      { available: false } | ({ available: true } & MarketingConsent)
    >(response);
    if (!data.available) return null;
    return { decided: data.decided, optedIn: data.optedIn };
  } catch {
    return null;
  }
}

export async function saveMarketingConsent(
  plugin: FileOrganizer,
  optIn: boolean
): Promise<boolean> {
  if (!canAskMarketingConsent(plugin)) return false;
  try {
    const response = await obsidianFetch(
      `${plugin.getServerUrl()}/api/marketing-consent`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${plugin.getApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ optIn }),
      }
    );
    if (!response.ok) return false;
    const data = await readResponseJson<{ success?: boolean }>(response);
    return data.success === true;
  } catch {
    return false;
  }
}
