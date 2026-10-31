import FileOrganizer from "../../index";
import React, { useState, useEffect } from "react";

interface CatalystGateProps {
  plugin: FileOrganizer;
  children: React.ReactNode;
}

export const CatalystGate: React.FC<CatalystGateProps> = ({
  plugin,
  children,
}) => {
  const [isCatalyst, setIsCatalyst] = useState<boolean>(
    Boolean(plugin.settings.hasCatalystAccess)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    void checkPremiumStatus();
  }, []);

  const checkPremiumStatus = async () => {
    try {
      setIsChecking(true);
      const isPremium = await plugin.checkCatalystAccess();
      plugin.settings.hasCatalystAccess = isPremium;
      await plugin.saveSettings();
      setIsCatalyst(isPremium);
    } catch (error) {
      console.error("Error checking premium status:", error);
    } finally {
      setIsLoading(false);
      setIsChecking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-[--text-muted]">Loading...</div>
      </div>
    );
  }

  if (!isCatalyst) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="bg-[--background-secondary] p-6 rounded-lg max-w-md">
          <h3 className="text-lg font-semibold mb-3 text-[--text-normal]">
            Catalyst Experiments
          </h3>
          <p className="text-[--text-muted] mb-4">
            Experimental features are available exclusively for Catalyst
            members. Upgrade to unlock:
          </p>
          <ul className="text-left text-[--text-muted] mb-4 space-y-2">
            <li>• Local LLM Integration</li>
            <li>• Atomic Notes Generation</li>
            <li>• And more experimental features...</li>
          </ul>
          <div className="flex flex-col gap-3">
            <a
              href="https://notecompanion.ai/?utm_source=obsidian&utm_medium=in-app&utm_campaign=catalyst-upgrade"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-[--interactive-accent] text-[--text-on-accent] rounded-lg hover:bg-[--interactive-accent-hover] transition-colors"
            >
              Upgrade to Catalyst
            </a>
            <button
              onClick={() => { void checkPremiumStatus(); }}
              disabled={isChecking}
              className="px-4 py-2 bg-[--background-modifier-border] text-[--text-muted] rounded-lg hover:bg-[--background-modifier-border-hover] transition-colors disabled:opacity-50"
            >
              {isChecking ? "Checking access..." : "Check Catalyst Access"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
};
