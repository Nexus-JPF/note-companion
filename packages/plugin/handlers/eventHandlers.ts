import { Notice, TFile } from "obsidian";
import FileOrganizer from "..";
import { Inbox } from "../inbox";
import { shouldShowInboxNotification } from "../inbox/notification-level";
import { VALID_MEDIA_EXTENSIONS } from "../constants";

function isInInboxFolder(filePath: string, pathToWatch: string): boolean {
  if (!pathToWatch) return false;
  return (
    filePath === pathToWatch || filePath.startsWith(pathToWatch + "/")
  );
}

export function registerEventHandlers(plugin: FileOrganizer) {
  // Read live: the recorder saves into the current inbox folder, so a changed folder must apply without a reload
  const getPathToWatch = () => plugin.settings.pathToWatch;

  plugin.registerEvent(
    plugin.app.vault.on("create", async file => {
      if (!plugin.settings.useInbox) return;
      await new Promise(resolve => window.setTimeout(resolve, 1000));
      if (!isInInboxFolder(file.path, getPathToWatch())) return;
      if (file instanceof TFile) {
        if (
          shouldShowInboxNotification(
            plugin.settings.inboxNotificationLevel,
            "debug"
          )
        ) {
          new Notice("Inbox is looking at new file: " + file.basename);
        }
        Inbox.getInstance().enqueueFiles([file]);
      }
    })
  );

  plugin.registerEvent(
    plugin.app.vault.on("rename", async (file, _oldPath) => {
      if (!plugin.settings.useInbox) return;
      await new Promise(resolve => window.setTimeout(resolve, 1000));
      if (!isInInboxFolder(file.path, getPathToWatch())) return;
      if (file instanceof TFile) {
        if (
          shouldShowInboxNotification(
            plugin.settings.inboxNotificationLevel,
            "debug"
          )
        ) {
          new Notice("Inbox is looking at new file: " + file.basename);
        }
        Inbox.getInstance().enqueueFiles([file]);
      }
    })
  );

  // When a media file in the inbox is modified (e.g. replaced with same name),
  // Obsidian may fire "modify" instead of "create" — enqueue so we still process it.
  plugin.registerEvent(
    plugin.app.vault.on("modify", (file) => {
      if (!plugin.settings.useInbox) return;
      if (!(file instanceof TFile)) return;
      if (!isInInboxFolder(file.path, getPathToWatch())) return;
      if (!VALID_MEDIA_EXTENSIONS.includes(file.extension)) return;
      Inbox.getInstance().enqueueFiles([file]);
    })
  );
}
