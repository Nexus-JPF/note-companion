import * as React from "react";
import { ErrorBox } from "./error-box";
import FileOrganizer from "../../../../index";
import { openPluginSettings } from "../../../../lib/open-plugin-settings";

interface LicenseValidatorProps {
  apiKey: string;
  onValidationComplete: () => void;
  plugin: FileOrganizer;
}

export const LicenseValidator: React.FC<LicenseValidatorProps> = ({
  apiKey,
  onValidationComplete,
  plugin,
}) => {
  const [licenseError, setLicenseError] = React.useState<string | null>(null);

  const hasKey = !!apiKey;

  const validateLicense = React.useCallback(async () => {
    if (!hasKey && !plugin.settings.enableSelfHosting) {
      // First run: nothing to validate yet, the setup prompt below handles it
      return;
    }

    // Skip validation if self-hosting is enabled
    // The server will accept any key when ENABLE_USER_MANAGEMENT=false
    if (plugin.settings.enableSelfHosting) {
      onValidationComplete();
      return;
    }

    try {
      setLicenseError(null);

      const isValid = await plugin.isLicenseKeyValid(apiKey);
      if (isValid) {
        onValidationComplete();
      } else {
        setLicenseError("Invalid license key");
      }
    } catch {
      setLicenseError("Failed to validate license key");
    }
  }, [apiKey, hasKey, onValidationComplete, plugin]);

  React.useEffect(() => {
    void validateLicense();
  }, [validateLicense]);



  if (!hasKey && !plugin.settings.enableSelfHosting) {
    return (
      <div className="flex flex-col gap-2 py-3">
        <div className="text-[--font-ui-smaller] font-semibold text-[--text-muted] uppercase">
          Set up Note Companion
        </div>
        <p className="m-0 text-[--text-normal]">
          Create a free account to start organizing your notes. It includes
          free AI usage.
        </p>
        <div>
          <button
            onClick={() => {
              plugin.settings.hasRunOnboarding = false;
              void plugin.saveSettings();
              void plugin.activateDashboard();
            }}
            className="mod-cta"
          >
            Get started
          </button>
        </div>
      </div>
    );
  }

  if (licenseError) {
    return (
      <ErrorBox
        message={`License key error: ${licenseError}`}
        description="Please check your license key in the plugin settings."
        actionButton={
          <div className="flex gap-2">
            <button
              onClick={() => { void validateLicense(); }}
              className="px-3 py-1.5  rounded hover:opacity-90 transition-opacity duration-200"
            >
              Retry
            </button>
            <button
              onClick={() => {
                openPluginSettings(plugin.app, "fileorganizer2000");
              }}
              className="px-3 py-1.5 bg-[--interactive-accent] text-[--text-on-accent] rounded hover:bg-[--interactive-accent-hover] transition-colors duration-200"
            >
              Open Settings
            </button>
          </div>
        }
      />
    );
  }

  return null;
};