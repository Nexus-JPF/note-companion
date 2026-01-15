import React, { useState } from "react";
import { SelectedItem } from "../selected-item";
import { ContextItemType, useContextItems } from "../use-context-items";
import { usePlugin } from "../../provider";
import { TFolder, Notice } from "obsidian";
import { X, Trash2 } from "lucide-react";
import { tw } from "../../../../lib/utils";

export const ContextItems: React.FC = () => {
  const plugin = usePlugin();
  const app = plugin.app;

  const {
    currentFile,
    includeCurrentFile,
    files,
    folders,
    youtubeVideos,
    tags,
    searchResults,
    removeByReference,
    toggleCurrentFile,
    textSelections,
    clearAll,
  } = useContextItems();

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Check if there are any context items to show clear button
  const hasContextItems =
    (currentFile && includeCurrentFile) ||
    Object.keys(files).length > 0 ||
    Object.keys(folders).length > 0 ||
    Object.keys(tags).length > 0 ||
    Object.keys(youtubeVideos).length > 0 ||
    Object.keys(searchResults).length > 0 ||
    Object.keys(textSelections).length > 0;

  const handleClearAll = () => {
    if (showClearConfirm) {
      clearAll();
      setShowClearConfirm(false);
      new Notice("Context cleared");
    } else {
      setShowClearConfirm(true);
      // Auto-hide confirmation after 3 seconds
      setTimeout(() => setShowClearConfirm(false), 3000);
    }
  };

  const prefixMap = {
    file: "📄",
    folder: "📁",
    tag: "🏷️",
    youtube: "🎥",

    search: "🔍",
    "text-selection": "✂️",
  } as const;

  const handleItemClick = (
    type: ContextItemType,
    id: string,
    title: string
  ) => {
    switch (type) {
      case "file":
        handleOpenFile(title);
        break;
      case "folder":
        handleOpenFolder(title);
        break;
      case "youtube":
        const videoId = id.replace("youtube-", "");
        window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank");
        break;
      case "tag":
        handleOpenTag(title);
        break;

      case "search":
        // Optionally handle search click - could show results in a modal
        break;
      case "text-selection":
        // Handle text selection click
        break;
    }
  };

  const handleOpenFile = async (fileTitle: string) => {
    const file = app.vault.getFiles().find(f => f.basename === fileTitle);
    if (file) {
      await app.workspace.openLinkText(file.path, "", true);
    }
  };


  const handleOpenFolder = (folderPath: string) => {
    const folder = app.vault.getAbstractFileByPath(folderPath);
    if (folder && folder instanceof TFolder) {
      const fileExplorerLeaf =
        app.workspace.getLeavesOfType("file-explorer")[0];
      if (fileExplorerLeaf) {
        app.workspace.revealLeaf(fileExplorerLeaf);
        app.workspace.setActiveLeaf(fileExplorerLeaf);
        const fileExplorer = fileExplorerLeaf.view as any;
        if (fileExplorer?.expandFolder) {
          fileExplorer.expandFolder(folder);
        }
      }
    }
  };

  const handleOpenTag = (tagName: string) => {
    // Open search with tag query
    const searchLeaf = app.workspace.getLeavesOfType("search")[0];
    if (searchLeaf) {
      app.workspace.revealLeaf(searchLeaf);
      const searchView = searchLeaf.view as any;
      if (searchView?.setQuery) {
        searchView.setQuery(`tag:${tagName}`);
      }
    }
  };

  return (
    <div className="flex-grow overflow-x-auto">
      <div className="flex flex-col space-y-2">
        {/* Clear Context button - only show when there are context items */}
        {hasContextItems && (
          <div className="flex items-center justify-end mb-1 gap-2">
            {showClearConfirm ? (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[--text-muted]">Clear context?</span>
                <button
                  onClick={handleClearAll}
                  className={tw(
                    "text-[--text-error] hover:text-[--text-error]",
                    "flex items-center gap-1 px-2 py-1 rounded",
                    "hover:bg-[--background-modifier-hover] transition-colors",
                    "font-medium"
                  )}
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Yes, clear</span>
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className={tw(
                    "text-[--text-muted] hover:text-[--text-normal]",
                    "px-2 py-1 rounded",
                    "hover:bg-[--background-modifier-hover] transition-colors"
                  )}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={handleClearAll}
                className={tw(
                  "text-xs text-[--text-muted] hover:text-[--text-normal]",
                  "flex items-center gap-1 px-2 py-1 rounded",
                  "hover:bg-[--background-modifier-hover] transition-colors"
                )}
                title="Clear all context items (files, folders, tags, etc.)"
              >
                <X className="w-3 h-3" />
                <span>Clear context</span>
              </button>
            )}
          </div>
        )}

        {/* Current file section */}
        {currentFile && includeCurrentFile && (
          <div className="flex space-x-2">
            <SelectedItem
              key="current-file"
              item={currentFile.title}
              onClick={() =>
                handleItemClick("file", currentFile.id, currentFile.title)
              }
              onRemove={toggleCurrentFile}
              prefix={`${prefixMap.file} `}
            />
          </div>
        )}

        {/* Files section */}
        {Object.values(files).length > 0 && (
          <div className="flex space-x-2">
            {Object.values(files).map(file => (
              <SelectedItem
                key={file.id}
                item={file.title}
                onClick={() => handleItemClick("file", file.id, file.title)}
                onRemove={() => removeByReference(file.reference)}
                prefix={`${prefixMap.file} `}
              />
            ))}
          </div>
        )}

        {/* Folders section */}
        {Object.values(folders).length > 0 && (
          <div className="flex space-x-2">
            {Object.values(folders).map(folder => (
              <SelectedItem
                key={folder.id}
                item={folder.name}
                onClick={() =>
                  handleItemClick("folder", folder.id, folder.name)
                }
                onRemove={() => removeByReference(folder.reference)}
                prefix={`${prefixMap.folder} `}
              />
            ))}
          </div>
        )}

        {/* Tags section */}
        {Object.values(tags).length > 0 && (
          <div className="flex space-x-2">
            {Object.values(tags).map(tag => (
              <SelectedItem
                key={tag.id}
                item={tag.name}
                onClick={() => handleItemClick("tag", tag.id, tag.name)}
                onRemove={() => removeByReference(tag.reference)}
                prefix={`${prefixMap.tag} `}
              />
            ))}
          </div>
        )}

        {/* YouTube section */}
        {Object.values(youtubeVideos).length > 0 && (
          <div className="flex space-x-2">
            {Object.values(youtubeVideos).map(video => (
              <SelectedItem
                key={video.id}
                item={video.title}
                onClick={() =>
                  handleItemClick("youtube", video.id, video.title)
                }
                onRemove={() => removeByReference(video.reference)}
                prefix={`${prefixMap.youtube} `}
              />
            ))}
          </div>
        )}

        {/* Search Results section */}
        {Object.values(searchResults).length > 0 && (
          <div className="flex space-x-2">
            {Object.values(searchResults).map(search => (
              <SelectedItem
                key={search.id}
                item={`"${search.query}" (${search.results.length} results)`}
                onClick={() =>
                  handleItemClick("search", search.id, search.query)
                }
                onRemove={() => removeByReference(search.reference)}
                prefix={`${prefixMap.search} `}
              />
            ))}
          </div>
        )}

        {/* Text Selections section */}
        {Object.values(textSelections).length > 0 && (
          <div className="flex space-x-2">
            {Object.values(textSelections).map(selection => (
              <SelectedItem
                key={selection.id}
                item={`${selection.content.slice(0, 30)}...`}
                onClick={() =>
                  handleItemClick("text-selection", selection.id, selection.content)
                }
                onRemove={() => removeByReference(selection.reference)}
                prefix={`${prefixMap["text-selection"]} `}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
