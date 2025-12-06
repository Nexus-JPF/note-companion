import { z } from "zod";

const settingsSchema = z.object({
  renameInstructions: z.string().describe("Instructions for how to rename files (leave empty for no renaming)"),
  customFolderInstructions: z.string().describe("Instructions for custom folder organization (leave empty for defaults)"),
  imageInstructions: z.string().describe("Instructions for image file handling (leave empty for defaults)"),
});

export const chatTools = {
  getSearchQuery: {
    description: "Extract semantic search queries to find relevant notes based on content and meaning",
    parameters: z.object({
      query: z.string().describe("The semantic search query to find relevant notes"),
    }),
  },
  searchByName: {
    description: "Search for files by name pattern or exact match, useful for finding specific notes or groups of notes",
    parameters: z.object({
      query: z.string().describe("The name pattern to search for (e.g., 'Untitled*', 'daily-*', or exact name)"),
    }),
  },
  openFile: {
    description: "Open a specific file in Obsidian workspace. Use this when the user asks to open, view, or navigate to a file.",
    parameters: z.object({
      filePath: z.string().describe("The full path of the file to open (e.g., 'folder/note.md')"),
    }),
  },
  getYoutubeVideoId: {
    description: "Retrieve YouTube video transcript and add it to context. After retrieving, automatically provide a summary of the video content based on the transcript. Use this when the user asks to summarize, analyze, or get information from a YouTube video.",
    parameters: z.object({
      videoId: z.string().describe("The YouTube video ID or full URL (e.g., 'ooNeVSVlCX4' or 'https://www.youtube.com/watch?v=ooNeVSVlCX4')"),
    }),
  },
  getLastModifiedFiles: {
    description: "Retrieve recently modified files to track changes and activity in the vault",
    parameters: z.object({
      count: z.number().describe("The number of last modified files to retrieve"),
    }),
  },
  appendContentToFile: {
    description: "Add new content to existing notes while preserving structure and formatting",
    parameters: z.object({
      content: z.string().describe("The formatted content to append to the file"),
      message: z.string().describe("Clear explanation of what content will be added"),
      fileName: z.string().describe("Specific file to append to, or empty string to use current file"),
    }),
  },
  addTextToDocument: {
    description: "Add new sections or content to notes with proper formatting and structure",
    parameters: z.object({
      content: z.string().describe("The formatted text content to add"),
      path: z.string().describe("Optional path to the document. If not provided, uses current document"),
    }),
  },
  modifyDocumentText: {
    description: "Edit existing note content while maintaining consistency and structure. Can modify selected text or entire document.",
    parameters: z.object({
      content: z.string().describe("The new formatted content to replace existing content"),
      path: z.string().describe("Optional path to the document. If not provided, uses current document"),
      instructions: z.string().describe("Optional specific instructions for how to modify the content"),
    }),
  },
  generateSettings: {
    description: "Create personalized vault organization settings based on user preferences and best practices",
    parameters: settingsSchema,
  },
  analyzeVaultStructure: {
    description: "Analyze vault organization and provide actionable improvement suggestions (used in onboarding), help me set up my vault organization settings",
    parameters: z.object({
      path: z.string().describe("Path to analyze. Use '/' for all files or specific folder path"),
      maxDepth: z.number().describe("Maximum folder depth to analyze (0 = unlimited)"),
    }),
  },

  moveFiles: {
    description: "Organize files into appropriate folders based on content and structure",
    parameters: z.object({
      moves: z.array(
        z.object({
          sourcePath: z.string().describe("Source path (e.g., '/' for root, or specific folder path)"),
          destinationPath: z.string().describe("Destination folder path"),
          pattern: z.object({
            namePattern: z.string().describe("File name pattern to match (e.g., 'untitled-*', 'daily-*', or empty for all files)"),
            extension: z.string().describe("File extension to match (or empty for all extensions)"),
          }),
        })
      ),
      message: z.string().describe("Clear explanation of the proposed file organization"),
    }),
  },
  renameFiles: {
    description: "Rename files intelligently based on content and organizational patterns",
    parameters: z.object({
      files: z.array(
        z.object({
          oldPath: z.string().describe("Current full path of the file"),
          newName: z.string().describe("Descriptive new file name based on content"),
        })
      ),
      message: z.string().describe("Clear explanation of the naming strategy"),
    }),
  },
  executeActionsOnFileBasedOnPrompt: {
    description: "Analyze and organize files through tagging, moving, or renaming based on content analysis",
    parameters: z.object({
      filePaths: z.array(z.string()).describe("List of file paths to analyze and organize"),
      userPrompt: z.string().describe("Specific instructions for file organization strategy"),
    }),
  },

  // New Metadata & Analysis Tools
  getFileMetadata: {
    description: "Extract comprehensive metadata from files including frontmatter, tags, links, headings, and creation/modification dates",
    parameters: z.object({
      filePaths: z.array(z.string()).describe("Paths of files to extract metadata from"),
      includeContent: z.boolean().describe("Whether to include file content (default: false)"),
      includeFrontmatter: z.boolean().describe("Include YAML frontmatter (default: true)"),
      includeTags: z.boolean().describe("Include all tags (default: true)"),
      includeLinks: z.boolean().describe("Include internal links and embeds (default: true)"),
      includeBacklinks: z.boolean().describe("Include backlinks from other notes (default: false)"),
    }),
  },

  updateFrontmatter: {
    description: "Update or add YAML frontmatter properties to files. Can add new properties, update existing ones, or delete properties.",
    parameters: z.object({
      filePath: z.string().describe("Path to the file to update"),
      updatesJson: z.string().describe("JSON string of properties to add/update (e.g., '{\"status\": \"in-progress\", \"priority\": \"high\"}' or '{}' for none)"),
      deletions: z.array(z.string()).describe("Array of property names to remove from frontmatter (empty array if none)"),
      message: z.string().describe("Clear explanation of what changes will be made"),
    }),
  },

  addTags: {
    description: "Add tags to files either in frontmatter or inline in content. Useful for categorizing and organizing notes.",
    parameters: z.object({
      filePaths: z.array(z.string()).describe("Files to tag"),
      tags: z.array(z.string()).describe("Tags to add (without # symbol, e.g., ['project', 'important'])"),
      location: z.enum(["frontmatter", "inline", "both"]).describe("Where to add tags: frontmatter (YAML tags array), inline (in content), or both"),
      inlinePosition: z.enum(["top", "bottom"]).describe("Position for inline tags (default: 'bottom')"),
      message: z.string().describe("Explanation of tagging strategy"),
    }),
  },

  getBacklinks: {
    description: "Get all files that link to specified files (backlinks/incoming links). Useful for understanding note relationships and knowledge graph connections.",
    parameters: z.object({
      filePaths: z.array(z.string()).describe("Files to get backlinks for"),
      includeUnresolved: z.boolean().describe("Include unresolved/broken links (default: false)"),
    }),
  },

  getOutgoingLinks: {
    description: "Get all outgoing links and embeds from files. Useful for understanding note dependencies and content structure.",
    parameters: z.object({
      filePaths: z.array(z.string()).describe("Files to analyze for outgoing links"),
      includeEmbeds: z.boolean().describe("Include embedded files/images (default: true)"),
      resolvedOnly: z.boolean().describe("Only include resolved links (default: false)"),
    }),
  },

  getHeadings: {
    description: "Extract document heading structure (H1-H6). Useful for understanding note organization and navigation.",
    parameters: z.object({
      filePaths: z.array(z.string()).describe("Files to extract headings from"),
      minLevel: z.number().min(1).max(6).describe("Minimum heading level (default: 1)"),
      maxLevel: z.number().min(1).max(6).describe("Maximum heading level (default: 6)"),
    }),
  },

  createNewFiles: {
    description: "Create new notes/documents in the vault with content and optionally link them together. Use this to split content into multiple files or create referenced documents.",
    parameters: z.object({
      files: z.array(
        z.object({
          fileName: z.string().describe("Name for the new file (without .md extension)"),
          content: z.string().describe("The markdown content for the new file"),
          folder: z.string().describe("Folder path where file should be created (default: root)"),
        })
      ).describe("Array of files to create"),
      linkInCurrentFile: z.boolean().describe("Whether to add links to these new files in the current active file (default: true)"),
      message: z.string().describe("Clear explanation of what files are being created and why"),
    }),
  },

  deleteFiles: {
    description: "Delete files from the vault with user confirmation. Use when user explicitly asks to delete, remove, or trash files. Always confirm before deletion.",
    parameters: z.object({
      filePaths: z.array(z.string()).describe("Full paths of files to delete"),
      reason: z.string().describe("Clear explanation of why these files should be deleted"),
      permanentDelete: z.boolean().describe("If true, permanently delete instead of moving to trash (default: false)"),
    }),
  },

  mergeFiles: {
    description: "Combine multiple files into a single file. Useful for consolidating related notes, combining meeting notes, or merging draft sections.",
    parameters: z.object({
      sourceFiles: z.array(z.string()).describe("Paths of files to merge (in order)"),
      outputFileName: z.string().describe("Name for the merged file (without .md extension)"),
      outputFolder: z.string().describe("Folder for output file (default: root)"),
      separator: z.string().describe("Content separator between merged files (default: '\\n\\n---\\n\\n')"),
      deleteSource: z.boolean().describe("Delete source files after merge (default: false)"),
      message: z.string().describe("Clear explanation of what's being merged and why"),
    }),
  },

  createTemplate: {
    description: "Create reusable note templates with placeholders and default structure. Useful for recurring note types like meeting notes, daily notes, project plans, etc.",
    parameters: z.object({
      templateName: z.string().describe("Name for the template file (without .md extension)"),
      templateContent: z.string().describe("Template content with placeholders like {{title}}, {{date}}, {{tags}}, etc."),
      templateFolder: z.string().describe("Folder to store template (default: 'Templates')"),
      description: z.string().describe("Description of what this template is for"),
      message: z.string().describe("Clear explanation of the template purpose and usage"),
    }),
  },

  bulkFindReplace: {
    description: "Find and replace text across multiple files. Useful for renaming terms, fixing typos, updating links, or refactoring content.",
    parameters: z.object({
      filePaths: z.array(z.string()).describe("Files to perform find/replace on"),
      find: z.string().describe("Text pattern to find (can be regex if useRegex is true)"),
      replace: z.string().describe("Replacement text"),
      useRegex: z.boolean().describe("Treat find pattern as regex (default: false)"),
      caseSensitive: z.boolean().describe("Case-sensitive search (default: true)"),
      message: z.string().describe("Clear explanation of what will be changed"),
    }),
  },

  exportToFormat: {
    description: "Export notes to different formats (PDF, HTML, plain text). Useful for sharing notes externally or creating backups.",
    parameters: z.object({
      filePaths: z.array(z.string()).describe("Files to export"),
      format: z.enum(["pdf", "html", "txt"]).describe("Export format"),
      outputFolder: z.string().describe("Folder for exported files (default: 'Exports')"),
      includeMetadata: z.boolean().describe("Include frontmatter in export (default: false)"),
      message: z.string().describe("Clear explanation of export operation"),
    }),
  },
} as const;