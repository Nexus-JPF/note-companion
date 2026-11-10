import { Notice } from "obsidian";
import type FileOrganizer from "../../index";
import { validateApiKey } from "../../apiUtils";
import { obsidianFetch } from "../../lib/obsidian-fetch";
import { readApiErrorMessage } from "../../lib/api-json";

export type TopUpKind = "minutes" | "credits-standard" | "credits-large";

export interface TopUpOption {
  kind: TopUpKind;
  label: string;
}

/** One-time purchases, same offers and labels as the original React settings. */
export const TOP_UP_OPTIONS: TopUpOption[] = [
  { kind: "minutes", label: "Top up 300 minutes ($10)" },
  { kind: "credits-standard", label: "Top up 5M credits ($15)" },
  { kind: "credits-large", label: "Top up 12M credits ($30)" },
];

export function getTopUpRequest(kind: TopUpKind): {
  path: string;
  body?: { tier: "standard" | "large" };
} {
  switch (kind) {
    case "minutes":
      return { path: "/api/top-up-minutes" };
    case "credits-standard":
      return { path: "/api/top-up", body: { tier: "standard" } };
    case "credits-large":
      return { path: "/api/top-up", body: { tier: "large" } };
  }
}

interface TopUpResponse {
  url?: string;
  licenseKey?: string;
  anonymousUserCreated?: boolean;
  invalidKeyDetected?: boolean;
}

/** Creates a checkout session and opens it in the browser. */
export async function startTopUp(
  plugin: FileOrganizer,
  kind: TopUpKind
): Promise<void> {
  const validation = validateApiKey(plugin.settings.API_KEY);
  if (!validation.isValid) {
    new Notice(validation.error || "Invalid API key", 5000);
    return;
  }

  try {
    const { path, body } = getTopUpRequest(kind);
    const response = await obsidianFetch(`${plugin.getServerUrl()}${path}`, {
      method: "POST",
      throw: false,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${plugin.settings.API_KEY}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      new Notice(
        `Top-up failed: ${await readApiErrorMessage(response)}`,
        6000
      );
      return;
    }

    const data = (await response.json()) as TopUpResponse;

    if (data.anonymousUserCreated && data.invalidKeyDetected) {
      new Notice(
        "Your API key was invalid. A new key has been generated and saved. Please use this key for future requests.",
        8000
      );
    } else if (data.anonymousUserCreated) {
      new Notice(
        "A new account was created for this purchase. Your new API key has been saved.",
        6000
      );
    }

    if (data.licenseKey) {
      plugin.settings.API_KEY = data.licenseKey;
      await plugin.saveSettings();
    }

    if (data.url) {
      window.open(data.url, "_blank");
    } else {
      new Notice("Top-up failed: no checkout link was returned.", 5000);
    }
  } catch (error) {
    console.error("Top-up error:", error);
    new Notice("Failed to process top-up request", 5000);
  }
}
