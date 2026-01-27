import React from "react";
import { motion } from "framer-motion";
import { App } from "obsidian";
import { ToolInvocation } from "ai";
import { YouTubeHandler } from "./youtube-handler";
import { SearchHandler } from "./search-handler";
import { DateRangeHandler } from "./date-range-handler";
import { LastModifiedHandler } from "./last-modified-handler";
import { OpenFileHandler } from "./open-file-handler";

import { SettingsUpdateHandler } from "./settings-update-handler";
import { AppendContentHandler } from "./append-content-handler";
import { OnboardHandler } from "./onboard-handler";
import { MoveFilesHandler } from "./move-files-handler";
import { RenameFilesHandler } from "./rename-files-handler";
import { SearchRenameHandler } from "./search-rename-handler";
import { ExecuteActionsHandler } from "./execute-actions-handler";
import { AddTextHandler } from "./add-text-handler";
import { ModifyTextHandler } from "./modify-text-handler";
import { MetadataHandler } from "./metadata-handler";
import { FrontmatterHandler } from "./frontmatter-handler";
import { TagsHandler } from "./tags-handler";
import { BacklinksHandler } from "./backlinks-handler";
import { OutgoingLinksHandler } from "./outgoing-links-handler";
import { HeadingsHandler } from "./headings-handler";
import { CreateFilesHandler } from "./create-files-handler";
import { DeleteFilesHandler } from "./delete-files-handler";
import { MergeFilesHandler } from "./merge-files-handler";
import { CreateTemplateHandler } from "./create-template-handler";
import { BulkFindReplaceHandler } from "./bulk-find-replace-handler";
import { ExportToFormatHandler } from "./export-to-format-handler";
import { ScreenpipeHandler } from "./screenpipe-handler";

interface ToolInvocationHandlerProps {
  toolInvocation: ToolInvocation;
  addToolResult: (result: { toolCallId: string; result: string }) => void;
  app: App;
}

function ToolInvocationHandler({
  toolInvocation,
  addToolResult,
  app,
}: ToolInvocationHandlerProps) {
  const toolCallId = toolInvocation.toolCallId;
  const handleAddResult = (result: string) =>
    addToolResult({ toolCallId, result });

  const getToolTitle = (toolName: string) => {
    const toolTitles = {
      getNotesForDateRange: "Fetching Notes",
      getSearchQuery: "Searching Notes",
      askForConfirmation: "Confirmation Required",
      getYoutubeVideoId: "YouTube Transcript",
      modifyCurrentNote: "Note Modification",
      getLastModifiedFiles: "Recent File Activity",

      generateSettings: "Settings Update",
      appendContentToFile: "Append Content",
      analyzeVaultStructure: "Vault Analysis",
      moveFiles: "Moving Files",
      renameFiles: "Renaming Files",
      searchByName: "Search Files by Name",
      openFile: "Opening File",
      executeActionsOnFileBasedOnPrompt: "Execute Actions on Files",
      addTextToDocument: "Adding Text to Document",
      modifyDocumentText: "Modifying Document Text",
      onboardUser: "Onboarding User",
      
      // New Metadata & Analysis Tools
      getFileMetadata: "File Metadata Extraction",
      updateFrontmatter: "Update Frontmatter",
      addTags: "Add Tags",
      getBacklinks: "Get Backlinks",
      getOutgoingLinks: "Get Outgoing Links",
      getHeadings: "Get Document Structure",
      createNewFiles: "Creating New Files",
      deleteFiles: "Deleting Files",
      mergeFiles: "Merging Files",
      createTemplate: "Creating Template",
      bulkFindReplace: "Find & Replace",
      exportToFormat: "Exporting Files",
      searchScreenpipe: "Search ScreenPipe",
    };
    return toolTitles[toolName] ;
  };

  const renderContent = () => {
    // Debug: Log tool name matching
    console.log("[ToolInvocationHandler] Rendering tool:", {
      toolName: toolInvocation.toolName,
      toolCallId: toolInvocation.toolCallId,
    });
    
    const handlers = {
      getSearchQuery: () => (
        <SearchHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      getYoutubeVideoId: () => (
        <YouTubeHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
        />
      ),
      getNotesForDateRange: () => (
        <DateRangeHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      getLastModifiedFiles: () => (
        <LastModifiedHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      openFile: () => (
        <OpenFileHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),

      generateSettings: () => (
        <SettingsUpdateHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
        />
      ),
      appendContentToFile: () => (
        <AppendContentHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
        />
      ),
      analyzeVaultStructure: () => (
        <OnboardHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      moveFiles: () => (
        <MoveFilesHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      renameFiles: () => (
        <RenameFilesHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      searchByName: () => (
        <SearchRenameHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      executeActionsOnFileBasedOnPrompt: () => (
        <ExecuteActionsHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      addTextToDocument: () => (
        <AddTextHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      modifyDocumentText: () => (
        <ModifyTextHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      
      // New Metadata & Analysis Tools
      getFileMetadata: () => (
        <MetadataHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      updateFrontmatter: () => (
        <FrontmatterHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      addTags: () => (
        <TagsHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      getBacklinks: () => (
        <BacklinksHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      getOutgoingLinks: () => (
        <OutgoingLinksHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      getHeadings: () => (
        <HeadingsHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      createNewFiles: () => (
        <CreateFilesHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      deleteFiles: () => (
        <DeleteFilesHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      mergeFiles: () => (
        <MergeFilesHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      createTemplate: () => (
        <CreateTemplateHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      bulkFindReplace: () => (
        <BulkFindReplaceHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      exportToFormat: () => (
        <ExportToFormatHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      searchScreenpipe: () => (
        <ScreenpipeHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
    };

    const handler = handlers[toolInvocation.toolName];
    if (!handler) {
      console.error("[ToolInvocationHandler] No handler found for tool:", toolInvocation.toolName);
      return (
        <div className="text-xs text-[--text-error] p-2">
          Unknown tool: {toolInvocation.toolName}
        </div>
      );
    }
    return handler();
  };

  const content = renderContent();
  
  return (
    <motion.div
      className="p-3 border border-[--background-modifier-border] rounded bg-[--background-secondary]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h4 className="m-0 mb-2 text-[--text-normal] text-sm font-semibold">
        {getToolTitle(toolInvocation.toolName)}
      </h4>
      <div className="text-sm text-[--text-muted]">{content}</div>
    </motion.div>
  );
}

export default ToolInvocationHandler;

