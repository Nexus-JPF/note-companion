import React, { useRef, useState } from "react";
import { App, TFile, Notice } from "obsidian";
import { ToolInvocation } from "ai";

interface CreateFilesHandlerProps {
  toolInvocation: ToolInvocation;
  handleAddResult: (result: string) => void;
  app: App;
}

interface FileToCreate {
  fileName: string;
  content: string;
  folder?: string;
}

export function CreateFilesHandler({
  toolInvocation,
  handleAddResult,
  app,
}: CreateFilesHandlerProps) {
  const hasFetchedRef = useRef(false);
  const [createdFiles, setCreatedFiles] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const createFiles = async (
    files: FileToCreate[],
    linkInCurrentFile: boolean = true
  ) => {
    const results: Array<{ path: string; success: boolean; error?: string }> = [];
    const createdPaths: string[] = [];

    for (const fileData of files) {
      try {
        // Normalize file name
        const fileName = fileData.fileName.endsWith(".md")
          ? fileData.fileName
          : `${fileData.fileName}.md`;

        // Determine full path
        const folder = fileData.folder || "";
        const fullPath = folder ? `${folder}/${fileName}` : fileName;

        // Check if folder exists, create if necessary
        if (folder) {
          const folderExists = app.vault.getAbstractFileByPath(folder);
          if (!folderExists) {
            await app.vault.createFolder(folder);
          }
        }

        // Check if file already exists
        const existingFile = app.vault.getAbstractFileByPath(fullPath);
        if (existingFile) {
          results.push({
            path: fullPath,
            success: false,
            error: "File already exists",
          });
          continue;
        }

        // Create the file
        await app.vault.create(fullPath, fileData.content);
        createdPaths.push(fullPath);

        results.push({
          path: fullPath,
          success: true,
        });
      } catch (error) {
        results.push({
          path: fileData.fileName,
          success: false,
          error: error.message,
        });
      }
    }

    // Add links to current file if requested
    if (linkInCurrentFile && createdPaths.length > 0) {
      try {
        const activeFile = app.workspace.getActiveFile();
        if (activeFile) {
          const currentContent = await app.vault.read(activeFile);
          const links = createdPaths
            .map((path) => {
              // Remove .md extension and create wikilink
              const linkText = path.replace(/\.md$/, "");
              return `- [[${linkText}]]`;
            })
            .join("\n");

          const newContent = `${currentContent}\n\n${links}`;
          await app.vault.modify(activeFile, newContent);
        }
      } catch (error) {
        console.error("Error adding links to current file:", error);
      }
    }

    return { results, createdPaths };
  };

  React.useEffect(() => {
    const handleCreateFiles = async () => {
      if (!hasFetchedRef.current && !("result" in toolInvocation)) {
        hasFetchedRef.current = true;
        const { files, linkInCurrentFile, message } = toolInvocation.args;

        // Normalize folder field - ensure it's always a string (defensive programming)
        const normalizedFiles = files.map((f: any) => ({
          ...f,
          folder: f.folder ?? "",
        }));

        // Normalize linkInCurrentFile - default to true if not provided
        const normalizedLinkInCurrentFile = linkInCurrentFile ?? true;

        setIsCreating(true);
        try {
          const { results, createdPaths } = await createFiles(
            normalizedFiles,
            normalizedLinkInCurrentFile
          );

          setCreatedFiles(createdPaths);

          const successCount = results.filter((r) => r.success).length;
          const failCount = results.filter((r) => !r.success).length;

          handleAddResult(
            JSON.stringify({
              success: true,
              created: successCount,
              failed: failCount,
              files: results,
              message: `Created ${successCount} file(s)${failCount > 0 ? `, ${failCount} failed` : ""}`,
            })
          );

          new Notice(
            `Created ${successCount} file(s)${failCount > 0 ? `, ${failCount} failed` : ""}`
          );
        } catch (error) {
          handleAddResult(
            JSON.stringify({
              success: false,
              error: `Failed to create files: ${error.message}`,
            })
          );
          new Notice(`Error creating files: ${error.message}`);
        } finally {
          setIsCreating(false);
        }
      }
    };

    handleCreateFiles();
  }, [toolInvocation, handleAddResult, app]);

  const { files, message } = toolInvocation.args;
  const isComplete = "result" in toolInvocation;

  return (
    <div className="text-sm border-b border-[--background-modifier-border] pb-2">
      <div className="text-[--text-muted] mb-1">{message}</div>
      {!isComplete ? (
        <div className="text-[--text-muted] text-xs">
          Creating {files.length} file(s)...
        </div>
      ) : (
        <div className="space-y-1">
          <div className="text-[--text-success] text-xs">
            ✓ Files created successfully
          </div>
          {createdFiles.length > 0 && (
            <div className="text-[--text-faint] text-xs">
              {createdFiles.map((path) => (
                <div key={path}>• {path}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
