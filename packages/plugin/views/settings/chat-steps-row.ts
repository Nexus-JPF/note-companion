import type { Setting } from "obsidian";
import type FileOrganizer from "../../index";

export type ChatStepsPreference = "auto" | 3 | 5;
type ChatStepsOption = "auto" | "3" | "5";

export const CHAT_STEPS_OPTIONS: Record<ChatStepsOption, string> = {
  auto: "Auto (recommended)",
  "3": "Lighter: fewer actions",
  "5": "Thorough: more actions",
};

/** Stored value -> dropdown option; anything unexpected falls back to auto. */
export function chatStepsToOption(value: unknown): ChatStepsOption {
  return value === 3 ? "3" : value === 5 ? "5" : "auto";
}

/** Dropdown option -> stored value (numbers for 3 and 5, as the chat expects). */
export function optionToChatSteps(option: string): ChatStepsPreference {
  return option === "3" ? 3 : option === "5" ? 5 : "auto";
}

/**
 * The declarative dropdown stores the option key as a string, but the chat
 * reads a number (or "auto"), so this setting needs a render row.
 */
export function renderChatStepsRow(
  plugin: FileOrganizer,
  setting: Setting
): void {
  setting
    .setName("Chat tool rounds")
    .setDesc(
      "How much the assistant can do per message before replying (search notes, open files, and similar). Auto is recommended; your subscription and note size may still apply limits."
    )
    .addDropdown(dropdown => {
      for (const [value, label] of Object.entries(CHAT_STEPS_OPTIONS)) {
        dropdown.addOption(value, label);
      }
      dropdown
        .setValue(chatStepsToOption(plugin.settings.chatMaxStepsPreference))
        .onChange(async value => {
          plugin.settings.chatMaxStepsPreference = optionToChatSteps(value);
          await plugin.saveSettings();
        });
    });
}
