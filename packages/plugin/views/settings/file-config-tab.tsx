import React, { useState, useEffect } from "react";
import FileOrganizer from "../../index";
import { cleanPath } from "../../someUtils";
import { DEFAULT_TEMPLATE_NAMES } from "../../fileUtils";
import { normalizePath, Modal } from "obsidian";
import { Search, X } from "lucide-react";
import { logger } from "../../services/logger";
interface FileConfigTabProps {
  plugin: FileOrganizer;
}

export const FileConfigTab: React.FC<FileConfigTabProps> = ({ plugin }) => {
  const [pathToWatch, setPathToWatch] = useState(plugin.settings.pathToWatch);
  const [attachmentsPath, setAttachmentsPath] = useState(
    plugin.settings.attachmentsPath
  );
  const [logFolderPath, setLogFolderPath] = useState(
    plugin.settings.logFolderPath
  );
  const [defaultDestinationPath, setDefaultDestinationPath] = useState(
    plugin.settings.defaultDestinationPath
  );
  const [ignoreFolders, setIgnoreFolders] = useState(
    plugin.settings.ignoreFolders.join(",")
  );
  const [backupFolderPath, setBackupFolderPath] = useState(
    plugin.settings.backupFolderPath
  );
  const [templatePaths, setTemplatePaths] = useState(
    plugin.settings.templatePaths
  );
  const [bypassedFilePath, setBypassedFilePath] = useState(
    plugin.settings.bypassedFilePath
  );
  const [errorFilePath, setErrorFilePath] = useState(
    plugin.settings.errorFilePath
  );
  const [recordingsFolderPath, setRecordingsFolderPath] = useState(
    plugin.settings.recordingsFolderPath
  );

  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [pathExistence, setPathExistence] = useState<Record<string, boolean>>(
    {}
  );

  const FolderList = React.memo(() => {
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<"all" | "active" | "ignored">(
      "active"
    );

    const allFolders = plugin.app.vault.getAllFolders();
    const availableFolders = plugin.getAllUserFolders();
    const ignoredFolders = plugin.getAllIgnoredFolders();

    const getFilteredFolders = () => {
      let folders = availableFolders;

      switch (filterType) {
        case "all":
          folders = allFolders.map(folder => folder.path);
          break;
        case "active":
          folders = availableFolders;
          break;
        case "ignored":
          folders = ignoredFolders;
          break;
        default:
          folders = availableFolders;
      }

      return folders.filter(folder =>
        folder.toLowerCase().includes(searchQuery.toLowerCase())
      );
    };

    const filteredFolders = getFilteredFolders();

    return (
      <div className="mb-8 p-4 bg-[--background-secondary] rounded-lg shadow-sm">
        <div className="mb-4">
          <p className="text-sm text-[--text-muted] mb-3">
            Use the search box to verify folder accessibility
          </p>

          {/* Tabs */}
          <div className="flex border-b border-[--background-modifier-border]">
            <button
              onClick={() => setFilterType("all")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                filterType === "all"
                  ? "border-[--interactive-accent] text-[--text-accent]"
                  : "border-transparent text-[--text-muted] hover:text-[--text-normal] hover:border-[--background-modifier-border]"
              }`}
            >
              All Folders
              <span
                className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                  filterType === "all"
                    ? "bg-[--interactive-accent] text-[--text-on-accent]"
                    : "bg-[--background-modifier-border] text-[--text-muted]"
                }`}
              >
                {allFolders.length}
              </span>
            </button>
            <button
              onClick={() => setFilterType("active")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                filterType === "active"
                  ? "border-[--interactive-accent] text-[--text-accent]"
                  : "border-transparent text-[--text-muted] hover:text-[--text-normal] hover:border-[--background-modifier-border]"
              }`}
            >
              Active Paths
              <span
                className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                  filterType === "active"
                    ? "bg-[--interactive-accent] text-[--text-on-accent]"
                    : "bg-[--background-modifier-border] text-[--text-muted]"
                }`}
              >
                {availableFolders.length}
              </span>
            </button>
            <button
              onClick={() => setFilterType("ignored")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                filterType === "ignored"
                  ? "border-[--interactive-accent] text-[--text-accent]"
                  : "border-transparent text-[--text-muted] hover:text-[--text-normal] hover:border-[--background-modifier-border]"
              }`}
            >
              Ignored Paths
              <span
                className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                  filterType === "ignored"
                    ? "bg-[--interactive-accent] text-[--text-on-accent]"
                    : "bg-[--background-modifier-border] text-[--text-muted]"
                }`}
              >
                {ignoredFolders.length}
              </span>
            </button>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-[--background-modifier-form-field] border border-[--background-modifier-border] rounded-md focus-within:border-[--interactive-accent] focus-within:ring-1 focus-within:ring-[--interactive-accent]">
            <Search className="w-4 h-4 text-[--text-muted] shrink-0" />
            <input
              type="text"
              placeholder="Search folders..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-0 p-0 text-[--text-normal] focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="shrink-0 flex items-center justify-center p-1 text-[--text-muted] hover:text-[--text-normal] transition-colors cursor-pointer rounded hover:bg-[--background-modifier-hover]"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 stroke-current" />
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[240px] overflow-y-auto border border-[--background-modifier-border] rounded-md bg-[--background-primary]">
          {filteredFolders.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-0.5">
              {filteredFolders.map(folder => (
                <div
                  key={folder}
                  className="px-3 py-2 text-[--text-normal] text-sm hover:bg-[--background-modifier-hover] cursor-default truncate"
                  title={folder}
                >
                  {folder}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-[--text-muted]">
              {searchQuery
                ? "No matching folders found"
                : "No available folders"}
            </div>
          )}
        </div>
      </div>
    );
  });

  const handleSettingChange = async (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    settingKey: keyof typeof plugin.settings
  ) => {
    setter(value);
    (plugin.settings as unknown)[settingKey] = value;
    await plugin.saveSettings();
  };

  const handleIgnoreFoldersChange = async (value: string) => {
    setIgnoreFolders(value);
    const trimmedValue = value.trim();
    if (trimmedValue === "*") {
      plugin.settings.ignoreFolders = ["*"];
    } else {
      plugin.settings.ignoreFolders = trimmedValue.split(",");
    }
    await plugin.saveSettings();
  };

  const checkPathExistence = async (path: string): Promise<boolean> => {
    try {
      const normalizedPath = normalizePath(path);
      const exists = await plugin.app.vault.adapter.exists(normalizedPath);
      return exists;
    } catch (error) {
      logger.error(`Error checking path existence: ${error}`);
      return false;
    }
  };

  const createFolder = async (path: string) => {
    try {
      const normalizedPath = normalizePath(path);
      await plugin.app.vault.createFolder(normalizedPath);
      return true;
    } catch (error) {
      logger.error(`Error creating folder: ${error}`);
      return false;
    }
  };

  useEffect(() => {
    const checkPaths = async () => {
      const pathsToCheck = [
        pathToWatch,
        attachmentsPath,
        logFolderPath,
        defaultDestinationPath,
        backupFolderPath,
        templatePaths,
        bypassedFilePath,
        errorFilePath,
      ];

      const existenceResults: Record<string, boolean> = {};
      for (const path of pathsToCheck) {
        existenceResults[path] = await checkPathExistence(path);
      }

      setPathExistence(existenceResults);
    };

    void checkPaths();
  }, [
    pathToWatch,
    attachmentsPath,
    logFolderPath,
    defaultDestinationPath,
    backupFolderPath,
    templatePaths,
    bypassedFilePath,
    errorFilePath,
  ]);

  useEffect(() => {
    const newWarnings: Record<string, string> = {};

    const checkPath = (path: string, key: string) => {
      if (path && cleanPath(path) !== path) {
        newWarnings[key] =
          "Path may contain leading/trailing slashes or spaces. Consider cleaning it.";
      }
    };

    checkPath(pathToWatch, "pathToWatch");
    checkPath(attachmentsPath, "attachmentsPath");
    checkPath(logFolderPath, "logFolderPath");
    checkPath(defaultDestinationPath, "defaultDestinationPath");
    checkPath(backupFolderPath, "backupFolderPath");
    checkPath(templatePaths, "templatePaths");
    checkPath(bypassedFilePath, "bypassedFilePath");
    checkPath(errorFilePath, "errorFilePath");

    // Special check for ignoreFolders
    if (ignoreFolders !== "*") {
      const folders = ignoreFolders.split(",");
      if (folders.some(folder => cleanPath(folder) !== folder.trim())) {
        newWarnings["ignoreFolders"] =
          "Some folder paths may need cleaning. Consider removing spaces or slashes.";
      }
    }

    setWarnings(newWarnings);
  }, [
    pathToWatch,
    attachmentsPath,
    logFolderPath,
    defaultDestinationPath,
    ignoreFolders,
    backupFolderPath,
    templatePaths,
    bypassedFilePath,
    errorFilePath,
  ]);

  const renderSettingItem = (
    name: string,
    description: string,
    value: string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    settingKey: string
  ) => (
    <div className="setting-item">
      <div className="setting-item-info">
        <div className="setting-item-name">{name}</div>
        <div className="setting-item-description">{description}</div>
        {warnings[settingKey] && (
          <div className="setting-item-warning" style={{ color: "orange" }}>
            Warning: {warnings[settingKey]}
          </div>
        )}
        {pathExistence[value] === false && (
          <div className="setting-item-error" style={{ color: "red" }}>
            Path does not exist.
            <button
              onClick={() => { void (async () => {
                const created = await createFolder(value);
                if (created) {
                  setPathExistence({ ...pathExistence, [value]: true });
                }
              })(); }}
            >
              Create folder
            </button>
          </div>
        )}
      </div>
      <div className="setting-item-control">
        <input
          type="text"
          placeholder="Enter your path"
          value={value}
          onChange={onChange}
        />
      </div>
    </div>
  );

  return (
    <div className="file-config-settings">
      <div className="mb-8">
        <p className="text-[--text-muted] mb-4">
          Configure which folders File Organizer can manage and monitor. This
          helps you:
        </p>
        <ul className="list-disc pl-6 text-[--text-muted] space-y-1 mb-6">
          <li>Define which folders to watch for new files</li>
          <li>Set up ignored paths to exclude from organization</li>
          <li>Manage attachment and backup locations</li>
          <li>Configure template and pattern directories</li>
        </ul>
        <div className="p-4 bg-[--background-primary-alt] rounded-lg border border-[--background-modifier-border]">
          <p className="text-sm text-[--text-accent]">
            💡 Tip: Use the folder overview below to understand your vault
            structure and verify your path configurations.
          </p>
        </div>
      </div>

      <FolderList key={Object.values(plugin.settings).join(",")} />

      <div className="border-t border-[--background-modifier-border] ">
        <h3 className="mb-4 text-lg font-medium text-[--text-normal]">
          Path Configuration
        </h3>
        {renderSettingItem(
          "Inbox folder",
          "Choose which folder to automatically organize files from",
          pathToWatch,
          e => {
            void handleSettingChange(e.target.value, setPathToWatch, "pathToWatch");
          },
          "pathToWatch"
        )}
        {renderSettingItem(
          "Attachments folder",
          "Enter the path to the folder where the original images will be moved.",
          attachmentsPath,
          e => {
            void handleSettingChange(
              e.target.value,
              setAttachmentsPath,
              "attachmentsPath"
            );
          },
          "attachmentsPath"
        )}
        {renderSettingItem(
          "File Organizer log folder",
          "Choose a folder for Organization Logs e.g. Ava/Logs.",
          logFolderPath,
          e => {
            void handleSettingChange(
              e.target.value,
              setLogFolderPath,
              "logFolderPath"
            );
          },
          "logFolderPath"
        )}
        {renderSettingItem(
          "Output folder path",
          "Enter the path where you want to save the processed files. e.g. Processed/myfavoritefolder",
          defaultDestinationPath,
          e => {
            void handleSettingChange(
              e.target.value,
              setDefaultDestinationPath,
              "defaultDestinationPath"
            );
          },
          "defaultDestinationPath"
        )}
        {renderSettingItem(
          "Ignore folders",
          "Enter folder paths to ignore during organization, separated by commas(e.g. Folder1,Folder2). Or * to ignore all folders",
          ignoreFolders,
          e => { void handleIgnoreFoldersChange(e.target.value); },
          "ignoreFolders"
        )}
        {renderSettingItem(
          "Backup folder",
          "Choose a folder for file backups.",
          backupFolderPath,
          e => {
            void handleSettingChange(
              e.target.value,
              setBackupFolderPath,
              "backupFolderPath"
            );
          },
          "backupFolderPath"
        )}
        {renderSettingItem(
          "Templates folder",
          "Choose a folder for document templates.",
          templatePaths,
          e => {
            void handleSettingChange(
              e.target.value,
              setTemplatePaths,
              "templatePaths"
            );
          },
          "templatePaths"
        )}
        <div className="setting-item">
          <div className="setting-item-info">
            <div className="setting-item-name">Restore Default Templates</div>
            <div className="setting-item-description">
              Restore the default plugin templates ({DEFAULT_TEMPLATE_NAMES.join(", ")}) to their original versions. Your custom templates will not be affected, and a default you edited is saved to the _previous folder first.
            </div>
          </div>
          <div className="setting-item-control">
            <button
              onClick={() => { void (async () => {
                const confirmed = await new Promise<boolean>(resolve => {
                  class RestoreTemplatesModal extends Modal {
                    onOpen() {
                      const { contentEl } = this;
                      contentEl.empty();
                      contentEl.createEl("h2", { text: "Restore default templates" });
                      contentEl.createEl("p", {
                        text: "This will restore the following templates to their original plugin versions:",
                      });
                      const list = contentEl.createEl("ul");
                      for (const templateName of DEFAULT_TEMPLATE_NAMES) {
                        list.createEl("li", { text: templateName });
                      }
                      contentEl.createEl("p", {
                        text: "Your custom templates will not be affected. If you edited one of these, your version is saved to the _previous folder inside your templates folder first.",
                        attr: { style: "margin-top: 1em; font-weight: bold;" },
                      });
                      const buttonContainer = contentEl.createDiv({
                        attr: { style: "display: flex; gap: 10px; margin-top: 1em;" },
                      });
                      buttonContainer
                        .createEl("button", { text: "Cancel" })
                        .addEventListener("click", () => {
                          resolve(false);
                          this.close();
                        });
                      buttonContainer
                        .createEl("button", {
                          text: "Restore",
                          attr: { style: "background: var(--interactive-accent);" },
                        })
                        .addEventListener("click", () => {
                          resolve(true);
                          this.close();
                        });
                    }
                  }
                  const modal = new RestoreTemplatesModal(plugin.app);
                  modal.open();
                });

                if (confirmed) {
                  try {
                    await plugin.restoreTemplates();
                  } catch {
                    // Error is already handled in restoreTemplates method
                  }
                }
              })(); }}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                background: "var(--interactive-accent)",
                color: "var(--text-on-accent)",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Restore Default Templates
            </button>
          </div>
        </div>
        {renderSettingItem(
          "Bypassed notes path",
          "Choose a folder for bypassed notes.",
          bypassedFilePath,
          e => {
            void handleSettingChange(
              e.target.value,
              setBypassedFilePath,
              "bypassedFilePath"
            );
          },
          "bypassedFilePath"
        )}
        {renderSettingItem(
          "Error notes path",
          "Choose a folder for error notes.",
          errorFilePath,
          e => {
            void handleSettingChange(
              e.target.value,
              setErrorFilePath,
              "errorFilePath"
            );
          },
          "errorFilePath"
        )}
        {renderSettingItem(
          "Recordings folder",
          "Choose a folder for meeting recordings.",
          recordingsFolderPath,
          e => {
            void handleSettingChange(
              e.target.value,
              setRecordingsFolderPath,
              "recordingsFolderPath"
            );
          },
          "recordingsFolderPath"
        )}
      </div>
    </div>
  );
};
