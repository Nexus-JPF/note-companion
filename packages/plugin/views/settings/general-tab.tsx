import React, { useState, useEffect } from "react";
import { Notice } from "obsidian";
import FileOrganizer from "../../index";
import { logger } from "../../services/logger";
import { UsageStats } from "../../components/usage-stats";
import { TopUpCredits } from "../../views/settings/top-up-credits";
import { AccountData } from "./account-data";

interface GeneralTabProps {
  plugin: FileOrganizer;
  userId?: string; // Make userId optional
  email?: string; // Make email optional
}

interface UsageData {
  tokenUsage: number;
  maxTokenUsage: number;
  audioTranscriptionMinutes: number;
  maxAudioTranscriptionMinutes: number;
  subscriptionStatus: string;
  currentPlan: string;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  plugin,
  userId,
  email,
}) => {
  const [licenseKey, setLicenseKey] = useState(plugin.settings.API_KEY);
  const [keyStatus, setKeyStatus] = useState<
    "valid" | "invalid" | "checking" | "idle"
  >(plugin.settings.API_KEY ? "checking" : "idle");
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);

  // Check key status on mount if we have a key
  useEffect(() => {
    if (plugin.settings.API_KEY) {
      checkLicenseStatus();
    }

    // Always fetch usage data regardless of license key status
    fetchUsageData();
  }, []);

  const fetchUsageData = async () => {
    try {
      setIsLoadingUsage(true);

      // Try to fetch usage data with current key
      const data = await plugin.fetchUsageStats();

      if (data) {
        setUsageData(data);

        // If the token usage meets or exceeds the limit, show a specific notice
        if (data.tokenUsage >= data.maxTokenUsage) {
          new Notice(
            "Token limit reached. Please upgrade your plan for more tokens.",
            5000
          );
        }
      }
    } catch (error) {
      console.error("Failed to fetch usage data:", error);
      // Don't set usage data to null on error - keep previous state
    } finally {
      setIsLoadingUsage(false);
    }
  };

  const checkLicenseStatus = async () => {
    if (!licenseKey) return;
    setKeyStatus("checking");
    const isValid = await plugin.isLicenseKeyValid(licenseKey);
    setKeyStatus(isValid ? "valid" : "invalid");

    // Refresh usage data after key validation
    if (isValid) {
      fetchUsageData();
    }
  };

  const handleLicenseKeyChange = async (value: string) => {
    setLicenseKey(value);
    setKeyStatus("idle");
    plugin.settings.API_KEY = value;
    await plugin.saveSettings();
  };

  const handleActivate = async () => {
    await checkLicenseStatus();
  };

  const getStatusIndicator = () => {
    switch (keyStatus) {
      case "valid":
        return (
          <div className="flex items-center text-[--text-success] text-sm">
            <svg
              className="w-4 h-4 mr-1.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            License key activated
          </div>
        );
      case "invalid":
        return (
          <div className="flex items-center text-[--text-error] text-sm">
            <svg
              className="w-4 h-4 mr-1.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Invalid license key
          </div>
        );
      case "checking":
        return (
          <div className="flex items-center text-[--text-muted] text-sm">
            <svg
              className="w-4 h-4 mr-1.5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Checking license key...
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="file-organizer-settings space-y-6">
      <div className="bg-[--background-primary-alt] p-4 rounded-lg">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-2 mt-0">
              Note Companion License Key
            </h3>
            <p className="text-[--text-muted] mb-4">
              Enter your license key to activate Note Companion.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                className={`flex-1 bg-[--background-primary] border rounded px-3 py-1.5 ${
                  keyStatus === "valid"
                    ? "border-[--text-success]"
                    : keyStatus === "invalid"
                    ? "border-[--text-error]"
                    : "border-[--background-modifier-border]"
                }`}
                placeholder="Enter your File Organizer License Key"
                value={licenseKey}
                onChange={e => handleLicenseKeyChange(e.target.value)}
              />
              <button
                onClick={handleActivate}
                className="bg-[--interactive-accent] text-[--text-on-accent] px-4 py-1.5 rounded hover:bg-[--interactive-accent-hover] transition-colors"
              >
                Activate
              </button>
            </div>
            {getStatusIndicator()}
          </div>
        </div>
      </div>

      {/* Usage Stats Section - Always visible */}
      <div className="bg-[--background-primary-alt] p-4 rounded-lg">
        <h3 className="text-lg font-medium mb-2 mt-0">Usage Statistics</h3>
        {isLoadingUsage ? (
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[--text-accent]"></div>
          </div>
        ) : usageData ? (
          <div className="space-y-3">
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className="text-xs font-semibold inline-block text-[--text-normal]">
                    Token Usage
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-[--text-normal]">
                    {usageData.tokenUsage.toLocaleString()} /{" "}
                    {usageData.maxTokenUsage.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-[--background-modifier-border]">
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      (usageData.tokenUsage / usageData.maxTokenUsage) * 100
                    )}%`,
                  }}
                  className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                    usageData.tokenUsage > usageData.maxTokenUsage * 0.9
                      ? "bg-[--text-error]"
                      : "bg-[--text-accent]"
                  }`}
                ></div>
              </div>
            </div>
            {/* Audio Transcription Usage */}
            {(usageData.maxAudioTranscriptionMinutes || 0) > 0 && (
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold inline-block text-[--text-normal]">
                      Audio Transcription
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold inline-block text-[--text-normal]">
                      {(usageData.audioTranscriptionMinutes || 0).toFixed(1)} /{" "}
                      {usageData.maxAudioTranscriptionMinutes} min
                    </span>
                  </div>
                </div>
                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-[--background-modifier-border]">
                  <div
                    style={{
                      width: `${Math.min(
                        100,
                        ((usageData.audioTranscriptionMinutes || 0) /
                          usageData.maxAudioTranscriptionMinutes) *
                          100
                      )}%`,
                    }}
                    className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                      (usageData.audioTranscriptionMinutes || 0) >
                      usageData.maxAudioTranscriptionMinutes * 0.9
                        ? "bg-[--text-error]"
                        : "bg-[--text-accent]"
                    }`}
                  ></div>
                </div>
              </div>
            )}
            <div className="text-sm text-[--text-muted]">
              <p>
                Plan:{" "}
                <span className="font-medium text-[--text-normal]">
                  {usageData.currentPlan || "Free"}
                </span>
              </p>
              <p>
                Status:{" "}
                <span
                  className={`font-medium ${
                    usageData.subscriptionStatus === "active"
                      ? "text-[--text-success]"
                      : "text-[--text-warning]"
                  }`}
                >
                  {usageData.subscriptionStatus === "active"
                    ? "Active"
                    : "Inactive"}
                </span>
              </p>
            </div>
            {usageData &&
              usageData.maxAudioTranscriptionMinutes > 0 &&
              usageData.audioTranscriptionMinutes >=
                usageData.maxAudioTranscriptionMinutes && (
                <div className="mt-2 p-3 bg-[--background-] bg-opacity-20 rounded text-[--text-error] text-sm">
                  Audio transcription quota reached. Please upgrade your plan or
                  wait for the next billing cycle.
                </div>
              )}
            {usageData && usageData.tokenUsage >= usageData.maxTokenUsage && (
              <div className="mt-2 p-3 bg-[--background-] bg-opacity-20 rounded text-[--text-error] text-sm">
                <strong>Token limit reached!</strong> You've used all your
                tokens for this month. Next reset is on the 1st of the coming
                month.
                <br />
                <br />
                Upgrade your plan if you'd like to to continue using Note
                Companion.
              </div>
            )}
          </div>
        ) : (
          <p className="text-[--text-muted] text-sm">
            {!plugin.settings.API_KEY
              ? "Please enter a license key to see usage statistics."
              : keyStatus === "invalid"
              ? "License key appears to be invalid. Enter a valid key to see detailed usage statistics."
              : "No usage data available. Please check your connection and try again."}
          </p>
        )}

        {/* Upgrade Plan button - only show for valid keys */}
        {usageData && (
          <div className="mt-4">
            <button
              onClick={() => plugin.openUpgradePlanModal()}
              className="w-full bg-[--interactive-accent] text-[--text-on-accent] px-4 py-2 rounded hover:bg-[--interactive-accent-hover] transition-colors"
            >
              Upgrade Plan
            </button>
          </div>
        )}
      </div>

      <div className="bg-[--background-primary-alt] p-4 rounded-lg">
        <h3 className="text-lg font-medium mb-4 mt-0">Quick Tutorial</h3>
        <div className="youtube-embed">
          <iframe
            width="100%"
            height="315"
            src="https://www.youtube.com/embed/X4yN4ykTJIo?si=QoMN-wNZSo1woQcB"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      </div>

      <AccountData
        plugin={plugin}
        onLicenseKeyChange={handleLicenseKeyChange}
      />

      <div className="bg-[--background-primary-alt] p-4 rounded-lg">
        <p className="file-organizer-support-text mb-4">
          Note Companion is an open-source initiative. If you find it valuable,
          please{" "}
          <a
            href="https://notecompanion.ai/?utm_source=obsidian&utm_medium=in-app&utm_campaign=support-us"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[--text-accent] hover:text-[--text-accent-hover]"
          >
            consider supporting us
          </a>{" "}
          to help improve and maintain the project. 🙏
        </p>
        <p className="text-[--text-muted]">
          <a
            href="https://discord.gg/UWH53WqFuE"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[--text-accent] hover:text-[--text-accent-hover]"
          >
            Need help? Ask me on Discord.
          </a>
        </p>
      </div>
    </div>
  );
};
