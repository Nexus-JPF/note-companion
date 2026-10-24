import React, { useState, useEffect } from "react";
import { usePlugin } from "../provider";
import { OnboardingWizard } from "./onboarding-wizard";

/**
 * Hosts the onboarding wizard. Once onboarding is done (or was already done),
 * this view hands off to the assistant sidebar and closes itself.
 */
export function MainDashboard() {
  const plugin = usePlugin();

  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean>(
    plugin.settings.hasRunOnboarding ?? false
  );

  const [landingTab, setLandingTab] = useState<"inbox" | "organizer">("inbox");

  useEffect(() => {
    if (!isOnboardingComplete) return;
    void (async () => {
      const view = await plugin.ensureAssistantView();
      view?.activateTab(landingTab);
      plugin.closeDashboard();
    })();
  }, [isOnboardingComplete, landingTab, plugin]);

  if (!isOnboardingComplete) {
    return (
      <OnboardingWizard
        plugin={plugin}
        onComplete={tab => {
          setLandingTab(tab);
          setIsOnboardingComplete(true);
        }}
      />
    );
  }

  return null;
}
