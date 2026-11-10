import type { Setting } from "obsidian";
import type FileOrganizer from "../../index";
import { FREE_TIER_TOKEN_LIMIT } from "../../constants";
import { summarizeUsage } from "./usage-summary";
import { TOP_UP_OPTIONS, startTopUp } from "./top-up";

/**
 * Renders the "Usage and plan" row of the declarative settings tab.
 * Obsidian 1.13+ builds settings from definitions and skips the React General
 * tab, so usage, quota warnings and the upgrade link are drawn here. The fetch
 * runs when the row is drawn (not in getSettingDefinitions, which must stay cheap).
 * Returns a cleanup so a late response never touches a row that was torn down.
 */
export function renderUsageRow(
  plugin: FileOrganizer,
  setting: Setting
): () => void {
  let disposed = false;
  let upgradeAdded = false;

  setting.setName("Usage this month");

  const showMessage = (message: string) => {
    if (!disposed) setting.setDesc(message);
  };

  const load = async () => {
    if (!plugin.settings.API_KEY) {
      showMessage("Enter a license key to see your plan and usage.");
      return;
    }
    showMessage("Loading usage...");
    try {
      const data = await plugin.fetchUsageStats();
      if (disposed) return;
      if (!data) {
        showMessage(
          "No usage data available. Check your license key and connection, then refresh."
        );
        return;
      }
      const summary = summarizeUsage(data, {
        now: new Date(),
        freeTierTokenLimit: FREE_TIER_TOKEN_LIMIT,
      });
      setting.setDesc(
        createFragment(frag => {
          for (const line of summary.lines) {
            frag.createDiv({ text: line });
          }
          for (const warning of summary.warnings) {
            const el = frag.createDiv({ text: warning });
            el.setCssProps({ color: "var(--text-error)" });
          }
        })
      );
      if (summary.showUpgrade && !upgradeAdded) {
        upgradeAdded = true;
        setting.addButton(button =>
          button
            .setButtonText("Upgrade plan")
            .setCta()
            .onClick(() => plugin.openUpgradePlanModal())
        );
      }
    } catch {
      showMessage("Could not load usage. Check your connection and refresh.");
    }
  };

  setting.addButton(button =>
    button.setButtonText("Refresh").onClick(() => {
      void load();
    })
  );
  setting.addButton(button =>
    button.setButtonText("Open dashboard").onClick(() => {
      window.open(`${plugin.getServerUrl()}/dashboard`, "_blank");
    })
  );

  void load();

  return () => {
    disposed = true;
  };
}

/** One-time purchases (extra minutes or credits); checkout opens in the browser. */
export function renderTopUpRow(plugin: FileOrganizer, setting: Setting): void {
  setting
    .setName("Top up")
    .setDesc(
      "One-time purchases that add to your current plan. Checkout opens in your browser."
    );
  for (const option of TOP_UP_OPTIONS) {
    setting.addButton(button =>
      button.setButtonText(option.label).onClick(async () => {
        button.setDisabled(true);
        try {
          await startTopUp(plugin, option.kind);
        } finally {
          button.setDisabled(false);
        }
      })
    );
  }
}
